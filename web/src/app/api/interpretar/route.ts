import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

// Converte um pedido em linguagem natural ("padarias em Curitiba abertas este ano com telefone")
// nos filtros da busca. Usa a IA cuja chave estiver configurada (OPENAI_API_KEY ou ANTHROPIC_API_KEY);
// sem nenhuma, uma interpretação local por palavras-chave e dicionário de segmentos.

type Cnae = { codigo: number; descricao: string };
type Municipio = { codigo: number; nome: string; uf: string; total: number };

const Pedido = z.object({
  uf: z.string().nullable().describe("Sigla da UF se o usuário citar um estado; senão null"),
  cidades: z.array(z.string()).describe("Nomes das cidades citadas, como escritos oficialmente"),
  cnaes: z.array(z.string()).describe("Códigos CNAE 2.3 de subclasse (7 dígitos, sem pontuação) que correspondem ao tipo de empresa"),
  termos_segmento: z.array(z.string()).describe("Palavras como aparecem nas descrições oficiais da CNAE, para busca textual"),
  porte: z.array(z.enum(["1", "3", "5"])).describe("1 = microempresa, 3 = pequeno porte, 5 = médio/grande"),
  abertura_de: z.string().nullable().describe("Data mínima de abertura, AAAA-MM-DD"),
  abertura_ate: z.string().nullable().describe("Data máxima de abertura, AAAA-MM-DD"),
  com_telefone: z.boolean(),
  com_email: z.boolean(),
  simples: z.boolean(),
  mei: z.boolean(),
  matriz: z.boolean(),
  capital_min: z.number().nullable().describe("Capital social mínimo em reais"),
  bairro: z.string().nullable(),
  nome: z.string().nullable().describe("Nome ou trecho do nome de uma empresa específica, se citado"),
  resposta: z.string().describe("Uma frase curta, em português, confirmando o que será buscado"),
});
type TPedido = z.infer<typeof Pedido>;

const SISTEMA = `Você converte pedidos de prospecção B2B em filtros de busca sobre a base de CNPJ da Receita Federal (empresas ativas no Brasil).

O usuário é um vendedor B2B procurando CLIENTES. O CNAE é o filtro mais importante: quase sempre preencha "cnaes".

Regras:
- "cnaes": escolha as subclasses CNAE 2.3 que melhor representam o tipo de empresa pedido, incluindo variações próximas (ex.: padaria → 1091102 e 4721102; dentista → 8630504). No máximo 8 códigos.
- Intenção de venda ("vender X para…", "quem compra X", "clientes para X", "empresas que precisam de X"): os CNAEs são os dos COMPRADORES de X, nunca de quem fabrica ou vende X. Ex.: "quem compra embalagens plásticas" → indústrias de alimentos, bebidas, cosméticos, limpeza e distribuidores que embalam produtos; "vender ração" → pet shops, agropecuárias, criadores; "vender software de gestão" → comércio varejista e serviços de pequeno porte.
- Necessidade ampla ("negócios que precisam de site/marketing/contabilidade"): escolha os 6 a 8 segmentos locais que mais compram isso (ex.: site/marketing → restaurantes, salões de beleza, clínicas odontológicas e médicas, academias, imobiliárias, lojas de roupa, oficinas). Não deixe "cnaes" vazio.
- Só deixe "cnaes" vazio se o pedido não indicar nenhum tipo de cliente (ex.: só cidade ou só um filtro como "com WhatsApp").
- "termos_segmento": 1 a 3 palavras do vocabulário oficial da CNAE (ex.: "odontológica" para dentista, "restaurantes" para restaurante).
- Datas relativas ("abertas no último ano", "novas", "recentes") viram abertura_de calculada a partir da data de hoje informada. "Novas" sem prazo = últimos 12 meses.
- "WhatsApp", "telefone", "dá pra ligar" → com_telefone = true. "E-mail" → com_email = true.
- Só preencha o que o usuário pediu. Booleanos não citados = false; listas não citadas = [].
- Se o pedido não for sobre encontrar empresas, devolva tudo vazio e explique em "resposta" o que a busca consegue fazer.`;

export async function POST(req: Request) {
  const { texto, uf, anterior } = (await req.json()) as { texto?: string; uf?: string; anterior?: Record<string, string> };
  if (!texto?.trim()) return Response.json({ erro: "Escreva o que você procura" }, { status: 400 });
  const ufAtual = (uf ?? "PR").toUpperCase();

  let pedido: TPedido;
  let motor: "openai" | "claude" | "local";
  try {
    if (process.env.OPENAI_API_KEY) {
      pedido = await interpretarComOpenAI(texto, ufAtual, anterior);
      motor = "openai";
    } else if (process.env.ANTHROPIC_API_KEY) {
      pedido = await interpretarComClaude(texto, ufAtual, anterior);
      motor = "claude";
    } else {
      pedido = await interpretarLocal(texto, ufAtual);
      motor = "local";
    }
  } catch (e) {
    if (e instanceof RecusaError) return Response.json({ erro: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ erro: "Muitas buscas seguidas. Tente em alguns segundos." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return Response.json({ erro: `Falha ao interpretar (${e.status})` }, { status: 502 });
    if (e instanceof OpenAI.RateLimitError) return Response.json({ erro: "Muitas buscas seguidas. Tente em alguns segundos." }, { status: 429 });
    if (e instanceof OpenAI.APIError) return Response.json({ erro: `Falha ao interpretar (${e.status})` }, { status: 502 });
    throw e;
  }

  return Response.json({ ...(await refinar(await resolver(pedido, ufAtual), anterior)), motor });
}

class RecusaError extends Error {}

const tituloCidade = (n: string) =>
  n.toLowerCase().split(" ").map((p) => (["de", "do", "da", "dos", "das"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ");

type Resolvido = Awaited<ReturnType<typeof resolver>>;
const CHAVES_FILTRO = ["uf", "municipio", "cnae", "porte", "abertura_de", "abertura_ate", "com_telefone", "com_email", "simples", "mei", "matriz", "capital_min", "bairro", "q"];

/**
 * Conversa: a nova mensagem refina a busca que já está na tela.
 * O segmento (CNAE) é o mais importante: se a mensagem não citar um novo tipo de empresa, o anterior continua.
 * O mesmo vale para a região e os demais filtros não mencionados.
 */
async function refinar(r: Resolvido, anterior?: Record<string, string>): Promise<Resolvido & { mantidos: string[] }> {
  const ant = Object.fromEntries(Object.entries(anterior ?? {}).filter(([k, v]) => CHAVES_FILTRO.includes(k) && v));
  if (!Object.keys(ant).length) return { ...r, mantidos: [] };
  const f = { ...r.filtros };
  const mantidos: string[] = [];
  let segmentos = r.entendido.segmentos;

  if (!f.cnae && ant.cnae) {
    f.cnae = ant.cnae;
    segmentos = await api<Cnae[]>("cnaes", { codigos: ant.cnae }).catch(() => []);
    mantidos.push("segmento");
  }
  const novaRegiao = !!f.municipio || (r.entendido.uf !== "PR" && !!f.uf) || r.entendido.naoEncontradas.length > 0;
  if (!novaRegiao) {
    if (ant.uf && !f.uf) f.uf = ant.uf;
    if (ant.municipio) { f.municipio = ant.municipio; mantidos.push("região"); }
  }
  for (const k of CHAVES_FILTRO) if (!(k in f) && ant[k] && !["uf", "municipio", "cnae"].includes(k)) f[k] = ant[k];

  let resposta = r.resposta;
  if (mantidos.includes("segmento")) {
    const seg = segmentos.slice(0, 2).map((c) => c.descricao.split(/[,(]/)[0].trim().toLowerCase()).join(" e ");
    const onde = r.entendido.cidades.length ? ` em ${r.entendido.cidades.map(tituloCidade).join(", ")}` : mantidos.includes("região") ? " na mesma região" : "";
    resposta = `Mantive o segmento da busca anterior (${seg}${segmentos.length > 2 ? "…" : ""}) e refinei${onde}.`;
  }
  return { ...r, filtros: f, resposta, entendido: { ...r.entendido, segmentos }, mantidos };
}

/** Contexto da conversa para a IA: a busca que já está na tela */
const contexto = (anterior?: Record<string, string>) =>
  anterior && Object.keys(anterior).length
    ? `\nBusca atual na tela (o pedido pode estar refinando ela): ${JSON.stringify(anterior)}. Se o pedido não citar um novo tipo de empresa, devolva cnaes = [] (o sistema mantém os atuais).`
    : "";

async function interpretarComOpenAI(texto: string, uf: string, anterior?: Record<string, string>): Promise<TPedido> {
  const client = new OpenAI();
  const hoje = new Date().toISOString().slice(0, 10);
  const resposta = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "low" },
    instructions: SISTEMA,
    input: `Hoje é ${hoje}. UF selecionada na tela: ${uf}.${contexto(anterior)}\n\nPedido: ${texto}`,
    text: { format: zodTextFormat(Pedido, "filtros_prospeccao") },
  });
  if (!resposta.output_parsed) throw new RecusaError("Não entendi o pedido. Tente algo como “clínicas odontológicas em Londrina com telefone”.");
  return resposta.output_parsed;
}

async function interpretarComClaude(texto: string, uf: string, anterior?: Record<string, string>): Promise<TPedido> {
  const client = new Anthropic();
  const hoje = new Date().toISOString().slice(0, 10);
  const resposta = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SISTEMA,
    output_config: { effort: "low", format: betaZodOutputFormat(Pedido) },
    messages: [{ role: "user", content: `Hoje é ${hoje}. UF selecionada na tela: ${uf}.${contexto(anterior)}\n\nPedido: ${texto}` }],
  });
  if (resposta.stop_reason === "refusal") throw new RecusaError("Não consegui interpretar esse pedido. Tente descrever o tipo de empresa e a região.");
  if (!resposta.parsed_output) throw new RecusaError("Não entendi o pedido. Tente algo como “clínicas odontológicas em Londrina com telefone”.");
  return resposta.parsed_output;
}

// ---------------------------------------------------------------------------
// Resolve nomes e códigos contra a nossa base (o modelo pode errar um código ou grafia).

async function api<T>(rota: string, params: Record<string, string>): Promise<T> {
  // Uma nova tentativa em falha de rede (o túnel de desenvolvimento às vezes derruba a conexão)
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await fetch(`${process.env.API_URL}/${rota}?${new URLSearchParams(params)}`, {
        headers: { "x-api-key": process.env.API_KEY ?? "" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`API ${rota}: ${r.status}`);
      return (await r.json()) as T;
    } catch (e) {
      if (tentativa >= 2) throw e;
    }
  }
}

// "BR" = todos os municípios do país (busca nacional da landing page)
// Lista de municípios muda só na carga mensal: guarda em memória por 1 h
const cacheMunicipios = new Map<string, { expira: number; lista: Promise<Municipio[]> }>();
function listarMunicipios(uf: string) {
  const item = cacheMunicipios.get(uf);
  if (item && item.expira > Date.now()) return item.lista;
  const lista = api<Municipio[]>("municipios", uf === "BR" ? {} : { uf });
  cacheMunicipios.set(uf, { expira: Date.now() + 3_600_000, lista });
  lista.catch(() => cacheMunicipios.delete(uf));
  return lista;
}

const norm = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

async function resolver(p: TPedido, ufAtual: string) {
  const uf = p.uf && /^[A-Za-z]{2}$/.test(p.uf) ? p.uf.toUpperCase() : ufAtual;
  const municipios = await listarMunicipios(uf);

  // Nome repetido em vários estados (ex.: "Bom Jesus"): fica com o de mais empresas
  const maior = (ms: Municipio[]) => ms.sort((a, b) => b.total - a.total)[0];
  let cidades = p.cidades
    .map((c) => {
      const n = norm(c);
      return maior(municipios.filter((m) => norm(m.nome) === n)) ?? maior(municipios.filter((m) => norm(m.nome).startsWith(n)));
    })
    .filter((m): m is Municipio => !!m);
  // Busca nacional: o estado vem da primeira cidade encontrada
  if (uf === "BR" && cidades.length) cidades = cidades.filter((c) => c.uf === cidades[0].uf);

  const codigos = p.cnaes.map((c) => c.replace(/\D/g, "")).filter((c) => c.length >= 6 && c.length <= 7);
  let cnaes = codigos.length ? await api<Cnae[]>("cnaes", { codigos: codigos.join(",") }) : [];
  if (!cnaes.length) {
    const porTermo = await Promise.all(p.termos_segmento.slice(0, 3).map((t) => api<Cnae[]>("cnaes", { q: t, limit: "3" })));
    cnaes = porTermo.flat();
  }
  cnaes = [...new Map(cnaes.map((c) => [c.codigo, c])).values()];

  const data = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const filtros: Record<string, string> = {};
  if (uf === "BR") filtros.uf = cidades[0]?.uf ?? "BR";
  else if (uf !== "PR") filtros.uf = uf;
  if (cidades.length) filtros.municipio = cidades.map((c) => c.codigo).join(",");
  if (cnaes.length) filtros.cnae = cnaes.map((c) => c.codigo).join(",");
  if (p.porte.length) filtros.porte = p.porte.join(",");
  if (data(p.abertura_de)) filtros.abertura_de = data(p.abertura_de)!;
  if (data(p.abertura_ate)) filtros.abertura_ate = data(p.abertura_ate)!;
  for (const k of ["com_telefone", "com_email", "simples", "mei", "matriz"] as const) if (p[k]) filtros[k] = "true";
  if (p.capital_min) filtros.capital_min = String(p.capital_min);
  if (p.bairro) filtros.bairro = p.bairro;
  if (p.nome) filtros.q = p.nome;

  const naoEncontradas = p.cidades.filter((c) => !cidades.some((m) => norm(m.nome).startsWith(norm(c))));
  return {
    filtros,
    resposta: p.resposta,
    entendido: { uf, cidades: cidades.map((c) => c.nome), segmentos: cnaes, naoEncontradas },
  };
}

// ---------------------------------------------------------------------------
// Plano B sem chave: palavras-chave + nomes de cidade + busca textual na CNAE.

const PARADAS = new Set(
  ("quero procuro preciso buscar encontrar empresas empresa de da do das dos em no na nos nas com sem que " +
    "para por e ou a o as os um uma uns umas tipo tipos regiao cidade cidades estado abertas aberta abertos novas " +
    "novos recentes ultimos ultimo ultimas meses mes anos ano telefone whatsapp email e-mail mei simples matriz " +
    "pequenas pequeno porte micro microempresa grande grandes media medias perto proximo proximas hoje").split(" "),
);

// Segmentos comuns → CNAEs (texto já normalizado, sem acento). O resolver descarta códigos inexistentes.
const SEGMENTOS: { padrao: RegExp; rotulo: string; cnaes: string[] }[] = [
  { padrao: /\bagro|\bcasas? de racao|\blojas? de racao/, rotulo: "agropecuárias e lojas de ração", cnaes: ["4789004", "4623109", "4771704", "4692300", "4683400"] },
  { padrao: /\bpet ?shops?\b|\bpets?\b/, rotulo: "pet shops", cnaes: ["4789004", "9609208"] },
  { padrao: /\bveterinari/, rotulo: "clínicas veterinárias", cnaes: ["7500100", "4771704"] },
  { padrao: /\bpadaria|\bpanificador|\bconfeitari/, rotulo: "padarias e confeitarias", cnaes: ["1091102", "4721101", "4721102"] },
  { padrao: /\b(super)?mercado|\bmercearia|\bmercadinho/, rotulo: "mercados e supermercados", cnaes: ["4711301", "4711302", "4712100"] },
  { padrao: /\bfarmacia|\bdrogaria/, rotulo: "farmácias e drogarias", cnaes: ["4771701", "4771702"] },
  { padrao: /\brestaurante|\blanchonete|\bpizzaria|\bhamburgueria/, rotulo: "restaurantes e lanchonetes", cnaes: ["5611201", "5611203"] },
  { padrao: /\bbar(es)?\b/, rotulo: "bares", cnaes: ["5611204"] },
  { padrao: /\bacademia/, rotulo: "academias", cnaes: ["9313100"] },
  { padrao: /\bsal(ao|oes) de beleza|\bcabeleireir|\bbarbearia|\bestetica/, rotulo: "salões de beleza e barbearias", cnaes: ["9602501", "9602502"] },
  { padrao: /\boficina|\bmecanica|\bauto ?center/, rotulo: "oficinas mecânicas", cnaes: ["4520001", "4520002", "4520003"] },
  { padrao: /\bdentista|\bodontolog/, rotulo: "clínicas odontológicas", cnaes: ["8630504"] },
  { padrao: /\bclinicas? medica|\bconsultorios? medico|\bmedicos?\b/, rotulo: "clínicas e consultórios médicos", cnaes: ["8630503", "8630502", "8630501"] },
  { padrao: /\bhospita/, rotulo: "hospitais", cnaes: ["8610101"] },
  { padrao: /\bcontabil|\bcontador/, rotulo: "escritórios de contabilidade", cnaes: ["6920601"] },
  { padrao: /\badvoga|\bjuridic/, rotulo: "escritórios de advocacia", cnaes: ["6911701"] },
  { padrao: /\bconstrutora|\bconstrucao civil/, rotulo: "construtoras", cnaes: ["4120400"] },
  { padrao: /\bmateria(l|is) de construcao|\bhome ?center/, rotulo: "lojas de material de construção", cnaes: ["4744099", "4744001"] },
  { padrao: /\bimobiliaria|\bcorretor(a|es)? de imove|\bcorretagem/, rotulo: "imobiliárias e corretores", cnaes: ["6821801", "6821802", "6822600"] },
  { padrao: /\bloteadora|\bincorporadora|\bincorporacao/, rotulo: "incorporadoras e loteadoras", cnaes: ["4110700", "6810201"] },
  { padrao: /\bcondominio|\badministradora de condominio/, rotulo: "condomínios e administradoras", cnaes: ["8112500", "6822600"] },
  { padrao: /\bautoescola|\bauto escola|\bcentros? de formacao de condutores/, rotulo: "autoescolas", cnaes: ["8599603"] },
  { padrao: /\bconcessionaria|\brevenda de (carros|veiculos)|\bloja de (carros|veiculos)/, rotulo: "lojas e concessionárias de veículos", cnaes: ["4511101", "4511102"] },
  { padrao: /\bmoveis\b|\bmoveleir|\bmarcenaria/, rotulo: "lojas e fábricas de móveis", cnaes: ["4754701", "3101200", "3102100"] },
  { padrao: /\botica/, rotulo: "óticas", cnaes: ["4774100"] },
  { padrao: /\bpsicolog/, rotulo: "psicólogos", cnaes: ["8650003"] },
  { padrao: /\bfisioterap/, rotulo: "fisioterapia", cnaes: ["8650004"] },
  { padrao: /\bnutricionist/, rotulo: "nutricionistas", cnaes: ["8650002"] },
  { padrao: /\blaboratorio/, rotulo: "laboratórios clínicos", cnaes: ["8640202"] },
  { padrao: /\bcreche|\beducacao infantil/, rotulo: "creches e educação infantil", cnaes: ["8511200", "8512100"] },
  { padrao: /\bcursos? de idioma|\bescolas? de (ingles|idiomas)/, rotulo: "escolas de idiomas", cnaes: ["8593700"] },
  { padrao: /\bgrafica/, rotulo: "gráficas", cnaes: ["1813001", "1813099"] },
  { padrao: /\blavanderia/, rotulo: "lavanderias", cnaes: ["9601701"] },
  { padrao: /\bfloricultura/, rotulo: "floriculturas", cnaes: ["4789002"] },
  { padrao: /\blojas? de celular|\bassistencia tecnica/, rotulo: "lojas de celular e assistência técnica", cnaes: ["4752100", "9512600"] },
  { padrao: /\bjoalheria|\brelojoaria/, rotulo: "joalherias e relojoarias", cnaes: ["4783101", "4783102"] },
  { padrao: /\bcalcado|\bsapataria/, rotulo: "lojas de calçados", cnaes: ["4782201"] },
  { padrao: /\bdistribuidora de bebida|\bbebidas\b/, rotulo: "distribuidoras de bebidas", cnaes: ["4635402", "4635499", "4723700"] },
  { padrao: /\bsorveteria|\bacaiteria|\bacai\b/, rotulo: "sorveterias e açaí", cnaes: ["5611205", "1053800"] },
  { padrao: /\bcafeteria|\bcafe\b/, rotulo: "cafeterias", cnaes: ["5611203", "5611201"] },
  { padrao: /\bigreja|\borganizacoes? religios/, rotulo: "igrejas", cnaes: ["9491000"] },
  { padrao: /\bhotel|\bpousada/, rotulo: "hotéis e pousadas", cnaes: ["5510801", "5590699"] },
  { padrao: /\bescola|\bcolegio/, rotulo: "escolas", cnaes: ["8513900", "8520100", "8512100"] },
  { padrao: /\btransportadora|\btransporte de carga/, rotulo: "transportadoras", cnaes: ["4930202", "4930201"] },
  { padrao: /\bloja(s)? de roupa|\bvestuario|\bboutique/, rotulo: "lojas de roupa", cnaes: ["4781400"] },
  { padrao: /\bpostos? de combustivel|\bpostos? de gasolina/, rotulo: "postos de combustível", cnaes: ["4731800"] },
  { padrao: /\bsoftware|\btecnologia|\bdesenvolvimento de sistemas/, rotulo: "empresas de software e TI", cnaes: ["6201501", "6202300", "6203100", "6204000"] },
  { padrao: /\bagencias? de (marketing|publicidade)|\bmarketing digital/, rotulo: "agências de marketing", cnaes: ["7311400", "7319002"] },
  { padrao: /\bfazenda|\bproduto(r|res) rura|\bpecuaria|\bgado\b/, rotulo: "produtores rurais e pecuária", cnaes: ["151201", "151202", "115600", "111302"] },
];

async function interpretarLocal(texto: string, uf: string): Promise<TPedido> {
  const t = norm(texto);
  const municipios = await listarMunicipios(uf);
  const cidades = municipios
    .filter((m) => new RegExp(`\\b${norm(m.nome).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t))
    .sort((a, b) => b.nome.length - a.nome.length || b.total - a.total)
    .slice(0, 5);
  let resto = t;
  for (const c of cidades) resto = resto.replace(norm(c.nome), " ");

  let abertura_de: string | null = null;
  const prazo = t.match(/ultim[oa]s?\s+(\d+)\s+(mes|meses|ano|anos)/);
  const meses = prazo ? Number(prazo[1]) * (prazo[2].startsWith("ano") ? 12 : 1) : /\b(novas?|novos?|recentes?|ultimo ano)\b/.test(t) ? 12 : 0;
  if (meses) {
    const d = new Date();
    d.setMonth(d.getMonth() - meses);
    abertura_de = d.toISOString().slice(0, 10);
  }
  const desde = t.match(/(?:desde|depois de|a partir de|apos)\s+(20\d{2}|19\d{2})/);
  if (desde) abertura_de = `${desde[1]}-01-01`;

  const porte: ("1" | "3" | "5")[] = [];
  if (/\b(micro|microempresas?|me)\b/.test(t)) porte.push("1");
  if (/pequen[oa]s? porte|\bepp\b|pequenas? empresas?/.test(t)) porte.push("3");
  if (/\b(grandes?|medias?)\b/.test(t)) porte.push("5");

  // "vender X para Y" / "clientes como Y": o segmento a buscar é Y, quem compra
  const intencao = resto.match(/\b(?:vender|oferecer|fornecer|atender|prospectar|revender|distribuir)\s+(.*?)\s+(?:para|pra|aos?|as)\s+(.+)$/);
  const alvo = intencao?.[2] ?? resto.match(/\bclientes?\s+(?:como|tipo|do tipo)?\s*(.+)$/)?.[1] ?? resto;

  const segmentos = SEGMENTOS.filter((s) => s.padrao.test(alvo));
  const termos = segmentos.length
    ? []
    : alvo
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !PARADAS.has(w) && !/^\d+$/.test(w))
        .map((w) => (w.endsWith("s") && w.length > 5 ? w.slice(0, -1) : w))
        .slice(0, 2);

  const rotulos = segmentos.map((s) => s.rotulo).join(", ");
  const resposta = segmentos.length
    ? intencao
      ? `Busquei quem compra o que você vende: ${rotulos}.`
      : `Busquei ${rotulos}.`
    : termos.length
      ? `Busquei segmentos com “${termos.join("”, “")}” na descrição da CNAE. Confira e ajuste nos filtros detalhados.`
      : "Apliquei os filtros que reconheci. Descreva também o tipo de empresa para refinar.";

  return {
    uf: null,
    cidades: cidades.map((c) => c.nome),
    cnaes: segmentos.flatMap((s) => s.cnaes),
    termos_segmento: termos,
    porte,
    abertura_de,
    abertura_ate: null,
    com_telefone: /telefone|whats|ligar|celular/.test(t),
    com_email: /e-?mail/.test(t),
    simples: /\bsimples\b/.test(t),
    mei: /\bmei\b/.test(t),
    matriz: /\bmatriz\b/.test(t),
    capital_min: null,
    bairro: null,
    // CNPJ (com ou sem pontuação) ou nome entre aspas viram busca por nome
    nome: texto.replace(/[.\-/\s]/g, "").match(/\d{8,14}/)?.[0] ?? texto.match(/["“”']([^"“”']{3,})["“”']/)?.[1] ?? null,
    resposta,
  };
}

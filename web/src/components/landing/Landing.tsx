"use client";

import {
  ArrowRight, ArrowUp, BadgeCheck, Building2, Check, ChevronDown, Database, Download, Filter, KanbanSquare, Loader2,
  MapPin, Radar, ShieldCheck, Shapes, Sparkles, Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Busca, type PontoMapa, type Resumo, type Stats, urlApi, useApi } from "@/lib/api";
import { escala, iniciais, nomeProprio, numero, porcentagem, tom } from "@/lib/formato";
import { Celular } from "../automacao/Automacao";
import { tituloCidade } from "../Filtros";
import { IconeWhatsApp, cx } from "../ui";

const MapaCalor = dynamic(() => import("../MapaCalor").then((m) => m.MapaCalor), {
  ssr: false,
  loading: () => <div className="glass skeleton h-full rounded-[var(--radius-card)]" />,
});

const NOMES_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
  PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

export function Landing() {
  const { dados: br } = useApi<Resumo>(urlApi("resumo"));
  const { dados: mapa } = useApi<PontoMapa[]>(urlApi("mapa"));
  const { dados: stats } = useApi<Stats>(urlApi("stats"));
  const mes = stats?.ultima_carga?.mes_referencia.split("-").reverse().join("/");

  return (
    <div className="overflow-x-clip">
      <Nav />

      {/* Hero */}
      <header className="relative mx-auto grid max-w-[1440px] items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:pt-16">
        <div className="pointer-events-none absolute -left-40 top-0 -z-10 size-[520px] rounded-full bg-lime/25 blur-[140px]" />
        <Revelar>
          <span className="inline-flex items-center gap-2 rounded-full border border-white bg-white/70 py-1 pl-1 pr-3 text-xs text-ink/70">
            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] text-lime">Novo</span> Busca por linguagem natural + CRM integrado
          </span>
          <h1 className="mt-5 text-[44px] leading-[1.02] tracking-tight sm:text-[64px] xl:text-[76px]">
            Encontre as empresas que{" "}
            <span className="relative whitespace-nowrap">
              compram de você
              <span className="bar-lime absolute inset-x-0 bottom-1 -z-10 h-4 rounded-full sm:h-5" />
            </span>
            .
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink/65">
            {br ? <Contador valor={br.total} formato={escala} /> : "28M"} de empresas ativas da Receita Federal, com filtros por cidade,
            segmento e porte, telefone e WhatsApp, num só lugar. Descreva o seu cliente ideal:
          </p>
          <BuscaAoVivo />
        </Revelar>

        <Revelar atraso={150} className="relative h-[460px] sm:h-[560px]">
          <MapaCalor pontos={mapa} uf="Brasil" selecionadas={[]} onCidade={(c) => { window.location.href = `/?uf=BR&municipio=${c}`; }} />
          <Flutuante className="-left-3 bottom-24 sm:-left-8">
            <Database className="size-4 text-lime" />
            <span><strong className="text-lg">{br ? <Contador valor={br.total} formato={escala} /> : "—"}</strong> empresas ativas</span>
          </Flutuante>
          <Flutuante className="-right-2 top-24 sm:-right-6" claro>
            <IconeWhatsApp className="size-5" />
            <span><strong>{br ? porcentagem(br.com_telefone, br.total) : "—"}</strong> com telefone</span>
          </Flutuante>
          <Flutuante className="bottom-6 right-24 hidden sm:flex" claro>
            <MapPin className="size-4" /> {mapa ? numero(mapa.length) : "—"} municípios
          </Flutuante>
        </Revelar>
      </header>

      {/* Faixa de confiança */}
      <div className="border-y border-white/80 bg-white/40">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-5 text-sm text-ink/60 sm:px-6 lg:px-8">
          <span className="flex items-center gap-2"><BadgeCheck className="size-4" /> Dados oficiais da Receita Federal</span>
          <span className="flex items-center gap-2"><Zap className="size-4" /> Base {mes ?? "mensal"} · atualização todo mês</span>
          <span className="flex items-center gap-2"><MapPin className="size-4" /> 27 estados e 5.570 municípios</span>
          <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Uso alinhado à LGPD</span>
        </div>
      </div>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-28 px-4 py-24 sm:px-6 lg:px-8">
        <Estados />
        <Recursos mes={mes} />
        <ComoFunciona />
        <SecaoIA />
        <Faq />
        <CtaFinal />
      </main>

      <Rodape />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navegação

function Nav() {
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const f = () => setRolou(window.scrollY > 20);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <div className="sticky top-3 z-40 px-4 sm:px-6 lg:px-8">
      <nav className={cx("mx-auto flex max-w-[1440px] items-center gap-3 rounded-full p-1.5 pl-4 transition-all", rolou ? "glass" : "bg-transparent")}>
        <Link href="/landing" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-ink text-lime"><Radar className="size-[18px]" /></span>
          <span className="text-lg font-semibold tracking-tight">radar<span className="text-muted">b2b</span></span>
        </Link>
        <div className="mx-auto hidden items-center gap-1 rounded-full bg-ink p-1 md:flex">
          {[["#estados", "Dados"], ["#recursos", "Recursos"], ["#como-funciona", "Como funciona"], ["#ia", "Automação IA"], ["#faq", "Dúvidas"]].map(([h, r]) => (
            <a key={h} href={h} className="rounded-full px-4 py-2 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">{r}</a>
          ))}
        </div>
        <Link href="/" className="ml-auto flex h-11 items-center gap-2 rounded-full bg-lime pl-5 pr-1.5 text-sm font-medium text-ink transition hover:bg-lime-deep md:ml-0">
          Abrir o app <span className="grid size-8 place-items-center rounded-full bg-ink text-lime"><ArrowRight className="size-4" /></span>
        </Link>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Busca ao vivo (dados reais)

type Interpretacao = { filtros: Record<string, string>; resposta: string; entendido: { cidades: string[]; segmentos: { codigo: number; descricao: string }[] } };
const SUGESTOES = ["Padarias em Recife com WhatsApp", "Clínicas odontológicas em Belo Horizonte", "Vender ração para agropecuárias em Goiás"];

function BuscaAoVivo() {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"livre" | "buscando" | "pronto" | "erro">("livre");
  const [r, setR] = useState<{ i: Interpretacao; busca: Busca; link: string } | null>(null);

  const buscar = async (t: string) => {
    if (!t.trim()) return;
    setTexto(t);
    setEstado("buscando");
    try {
      const i: Interpretacao = await fetch("/api/interpretar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: t, uf: "BR" }),
      }).then((x) => x.json());
      if (!i.filtros) throw new Error();
      const q = new URLSearchParams(i.filtros);
      const api = new URLSearchParams(q);
      if (api.get("uf") === "BR") api.delete("uf");
      api.set("limit", "3");
      const busca: Busca = await fetch(urlApi("empresas", api)).then((x) => x.json());
      setR({ i, busca, link: `/?${q}` });
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  };

  return (
    <div className="mt-7 max-w-xl">
      <form onSubmit={(e) => { e.preventDefault(); buscar(texto); }}
        className="glass flex items-center gap-2 rounded-full p-1.5 pl-5 focus-within:ring-2 focus-within:ring-ink/10">
        <Sparkles className="size-4 shrink-0 text-ink/40" />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: pet shops em Curitiba com WhatsApp"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink/35" />
        <button type="submit" aria-label="Buscar" disabled={estado === "buscando"}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-lime transition hover:scale-105">
          {estado === "buscando" ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>

      {estado === "livre" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" onClick={() => buscar(s)}
              className="rounded-full border border-white bg-white/50 px-3 py-1.5 text-xs text-ink/65 transition hover:bg-white hover:text-ink">
              {s}
            </button>
          ))}
        </div>
      )}
      {estado === "erro" && <p className="mt-3 text-sm text-[#b4232a]">Não consegui buscar agora. Tente de novo em instantes.</p>}

      {estado === "buscando" && <div className="glass skeleton mt-3 h-44 rounded-3xl" />}
      {estado === "pronto" && r && (
        <div className="glass mt-3 overflow-hidden rounded-3xl [animation:aparecer_.4s_ease-out]">
          <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-3">
            <div>
              <p className="text-xs text-muted">Encontramos</p>
              <p className="text-4xl leading-none tracking-tight"><Contador valor={r.busca.total} formato={escala} /> <span className="text-base text-ink/60">empresas</span></p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {r.i.entendido.segmentos.slice(0, 2).map((s) => (
                <span key={s.codigo} className="flex max-w-[200px] items-center gap-1 truncate rounded-full bg-lime px-2.5 py-1 text-[11px]"><Shapes className="size-3 shrink-0" /><span className="truncate">{s.descricao}</span></span>
              ))}
              {r.i.entendido.cidades.slice(0, 1).map((c) => (
                <span key={c} className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] text-white"><MapPin className="size-3" />{tituloCidade(c)}</span>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-ink/5 border-t border-ink/5">
            {r.busca.resultados.map((e, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: tom(String(i) + (e.razao_social ?? "")) }}>{iniciais(e.nome_fantasia || e.razao_social)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{mascararNome(nomeProprio(e.nome_fantasia || e.razao_social))}</span>
                  <span className="block truncate text-xs text-muted">{e.municipio ? tituloCidade(e.municipio) : ""} · {e.uf}</span>
                </span>
                <span className="hidden text-xs tabular-nums text-ink/50 sm:block">{e.telefone1 ? `(${e.telefone1.slice(0, 2)}) ${e.telefone1.slice(2, 3)}••••-••${e.telefone1.slice(-2)}` : ""}</span>
              </li>
            ))}
          </ul>
          <Link href={r.link} className="flex items-center justify-between bg-ink px-5 py-3.5 text-sm text-white transition hover:bg-coal-2">
            Ver as {escala(r.busca.total)} empresas no app, com telefone e endereço <ArrowRight className="size-4 text-lime" />
          </Link>
        </div>
      )}
    </div>
  );
}

/** Página pública: mostra só a primeira palavra do nome (MEIs costumam usar o nome do titular). */
const mascararNome = (n: string) => {
  const [primeira, ...resto] = n.split(" ");
  return resto.length ? `${primeira} ${resto.map((p) => p[0] + "•••").join(" ")}` : primeira;
};


// ---------------------------------------------------------------------------
// Seletor de estados (números reais)

function Estados() {
  const [uf, setUf] = useState("SP");
  const { dados } = useApi<Resumo>(urlApi("resumo", new URLSearchParams({ uf })));
  const max = Math.max(1, ...(dados?.top_municipios.map((m) => m.total) ?? [1]));

  return (
    <section id="estados" className="scroll-mt-24">
      <Revelar>
        <Titulo selo="Dados ao vivo" titulo="O Brasil inteiro, estado por estado" sub="Clique num estado para ver o tamanho do seu mercado lá. Números reais da base atual." />
      </Revelar>
      <Revelar atraso={100} className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="glass flex flex-wrap content-start gap-1.5 rounded-[var(--radius-card)] p-5">
          {Object.keys(NOMES_UF).map((u) => (
            <button key={u} type="button" onClick={() => setUf(u)} title={NOMES_UF[u]}
              className={cx("h-11 w-14 rounded-2xl text-sm transition", u === uf ? "bg-ink font-medium text-lime" : "bg-white/70 hover:bg-white")}>
              {u}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 overflow-hidden rounded-[var(--radius-panel)] bg-coal p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-lime/15 blur-[90px]" />
          <p className="text-sm text-white/55">{NOMES_UF[uf]}</p>
          {dados ? (
            <div key={uf} className="[animation:aparecer_.35s_ease-out]">
              <div className="mt-2 grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Numero rotulo="Empresas ativas" valor={escala(dados.total)} destaque />
                <Numero rotulo="Com telefone" valor={porcentagem(dados.com_telefone, dados.total)} />
                <Numero rotulo="Abertas em 12 meses" valor={escala(dados.novas_12m)} />
                <Numero rotulo="MEI" valor={escala(dados.mei)} />
              </div>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-3 text-xs text-white/50">Cidades com mais empresas</p>
                  {dados.top_municipios.map((m) => (
                    <div key={m.codigo} className="mb-2.5">
                      <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate">{tituloCidade(m.nome)}</span><span className="shrink-0 text-white/55">{escala(m.total)}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-white/10"><div className="bar-lime h-full rounded-full transition-all duration-700" style={{ width: `${(m.total / max) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="mb-3 text-xs text-white/50">Segmentos que mais aparecem</p>
                  <div className="flex flex-col gap-1.5">
                    {dados.top_cnaes.map((c, i) => (
                      <div key={c.codigo} className={cx("flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm", i === 0 ? "bg-lime text-ink" : "bg-white/5")}>
                        <span className="min-w-0 truncate">{c.descricao}</span><span className={cx("shrink-0 text-xs", i === 0 ? "text-ink/60" : "text-white/50")}>{escala(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Link href={`/?uf=${uf}`} className="mt-7 inline-flex items-center gap-2 text-sm text-lime hover:underline">
                Explorar {NOMES_UF[uf]} no app <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="skeleton-dark mt-4 h-72 rounded-3xl" />
          )}
        </div>
      </Revelar>
    </section>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className={cx("text-3xl tracking-tight tabular-nums sm:text-4xl", destaque && "text-lime")}>{valor}</p>
      <p className="mt-1 text-xs text-white/50">{rotulo}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recursos (bento com microanimações)

function Recursos({ mes }: { mes?: string }) {
  return (
    <section id="recursos" className="scroll-mt-24">
      <Revelar>
        <Titulo selo="Recursos" titulo="Tudo o que o time comercial precisa para prospectar" sub="Da primeira busca ao fechamento, sem planilha nem copiar e colar." />
      </Revelar>
      <div className="mt-8 grid auto-rows-[minmax(240px,auto)] gap-4 md:grid-cols-6">
        <Revelar className="md:col-span-4"><CardBusca /></Revelar>
        <Revelar atraso={80} className="md:col-span-2"><CardWhats /></Revelar>
        <Revelar className="md:col-span-2"><CardFiltros /></Revelar>
        <Revelar atraso={80} className="md:col-span-4"><CardKanban /></Revelar>
        <Revelar className="md:col-span-3"><CardExportar /></Revelar>
        <Revelar atraso={80} className="md:col-span-3"><CardBase mes={mes} /></Revelar>
      </div>
    </section>
  );
}

function Bento({ titulo, texto, icone, children, escuro, className }: {
  titulo: string; texto: string; icone: ReactNode; children?: ReactNode; escuro?: boolean; className?: string;
}) {
  return (
    <article className={cx("flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] p-6", escuro ? "bg-coal text-white" : "glass", className)}>
      <span className={cx("grid size-10 place-items-center rounded-full", escuro ? "bg-white/10 text-lime" : "bg-ink text-lime")}>{icone}</span>
      <h3 className="mt-4 text-xl tracking-tight">{titulo}</h3>
      <p className={cx("mt-1 max-w-md text-sm", escuro ? "text-white/60" : "text-ink/60")}>{texto}</p>
      <div className="mt-5 flex-1">{children}</div>
    </article>
  );
}

const FRASES = ["oficinas mecânicas em Campinas", "escritórios de contabilidade abertos este ano", "restaurantes em Fortaleza com WhatsApp", "lojas de material de construção no Sul"];

function CardBusca() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const frase = FRASES[i];
    if (n < frase.length) { const t = setTimeout(() => setN(n + 1), 45); return () => clearTimeout(t); }
    const t = setTimeout(() => { setI((i + 1) % FRASES.length); setN(0); }, 1800);
    return () => clearTimeout(t);
  }, [i, n]);
  return (
    <Bento escuro icone={<Sparkles className="size-[18px]" />} titulo="Busca em linguagem natural"
      texto="Escreva como você fala. A busca entende segmento, cidade, prazo de abertura e contato, e monta os filtros sozinha.">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="font-mono text-sm text-white/85">“{FRASES[i].slice(0, n)}<span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-lime" />”</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {n === FRASES[i].length && ["segmento", "cidade", "filtros aplicados"].map((t, k) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-ink [animation:aparecer_.3s_ease-out_both]" style={{ animationDelay: `${k * 120}ms` }}><Check className="size-3" />{t}</span>
          ))}
        </div>
      </div>
    </Bento>
  );
}

function CardWhats() {
  return (
    <Bento icone={<IconeWhatsApp className="size-5" />} titulo="WhatsApp em 1 clique" texto="Celulares identificados automaticamente. Clicou, a conversa abre e o lead entra no seu funil.">
      <div className="flex items-center gap-3 rounded-3xl bg-white/80 p-3">
        <span className="grid size-9 place-items-center rounded-full bg-[#f2c7a5] text-xs font-semibold">PQ</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">Padaria Pão Quente</span><span className="text-xs text-muted">(81) 9••••-••21</span></span>
        <span className="relative grid size-10 place-items-center rounded-full bg-[#25D366]/15">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/25" />
          <IconeWhatsApp className="relative size-6" />
        </span>
      </div>
    </Bento>
  );
}

const CHIPS = ["Com telefone", "MEI", "Abertas em 6 meses", "Pequeno porte", "Simples", "Somente matriz"];
function CardFiltros() {
  const [ativos, setAtivos] = useState<number[]>([0]);
  useEffect(() => {
    const t = setInterval(() => setAtivos((a) => (a.length >= 3 ? [((a.at(-1) ?? 0) + 1) % CHIPS.length] : [...a, (a.at(-1)! + 2) % CHIPS.length])), 1300);
    return () => clearInterval(t);
  }, []);
  return (
    <Bento icone={<Filter className="size-[18px]" />} titulo="Filtros de quem vende" texto="Cidade, bairro, segmento, porte, regime, idade da empresa e capital social.">
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c, i) => (
          <span key={c} className={cx("rounded-full px-3 py-1.5 text-xs transition-all duration-300", ativos.includes(i) ? "scale-105 bg-ink text-lime" : "bg-white/70 text-ink/55")}>{c}</span>
        ))}
      </div>
    </Bento>
  );
}

function CardKanban() {
  const colunas = [
    { nome: "Novos", cor: "#a3b5c6" },
    { nome: "Em contato", cor: "#b9a7f5" },
    { nome: "Proposta", cor: "#f5cf5b" },
    { nome: "Ganhos", cor: "#e3fc3f" },
  ];
  return (
    <Bento icone={<KanbanSquare className="size-[18px]" />} titulo="CRM kanban integrado"
      texto="Leve empresas da busca direto para o funil. Arraste entre etapas, registre valor, notas e próximo follow-up.">
      <div className="relative grid grid-cols-4 gap-2">
        {colunas.map((c) => (
          <div key={c.nome} className="min-h-[120px] rounded-2xl bg-white/50 p-2">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium"><span className="size-2 rounded-full" style={{ background: c.cor }} />{c.nome}</div>
            <div className="h-7 rounded-xl bg-white/80" />
          </div>
        ))}
        <div className="absolute left-2 top-[60px] w-[calc(25%-12px)] rounded-xl border border-white bg-white p-2 shadow-[0_12px_30px_-12px_rgb(20_21_24/0.4)] [animation:kanban_7s_ease-in-out_infinite]">
          <p className="truncate text-[11px] font-medium">Clínica Sorriso</p>
          <p className="text-[10px] text-muted">R$ 4.500</p>
        </div>
      </div>
    </Bento>
  );
}

function CardExportar() {
  return (
    <Bento icone={<Download className="size-[18px]" />} titulo="Exporta para Excel e CRM" texto="CSV pronto para abrir no Excel, com até 20 mil empresas por exportação.">
      <div className="overflow-hidden rounded-2xl border border-white bg-white/70 text-[11px]">
        {[["Razão social", "Cidade", "Telefone"], ["Pão Quente LTDA", "Recife", "(81) 9••••"], ["Sorriso Odonto", "BH", "(31) 3•••"], ["AgroVale Rações", "Goiânia", "(62) 9••••"]].map((l, i) => (
          <div key={i} className={cx("grid grid-cols-3 gap-2 px-3 py-1.5", i === 0 ? "bg-ink font-medium text-white" : "border-t border-ink/5")}>
            {l.map((c) => <span key={c} className="truncate">{c}</span>)}
          </div>
        ))}
      </div>
    </Bento>
  );
}

function CardBase({ mes }: { mes?: string }) {
  return (
    <Bento icone={<Database className="size-[18px]" />} titulo="Base oficial, atualizada todo mês" texto="Os dados abertos do CNPJ entram automaticamente a cada nova publicação da Receita Federal." className="hatch-dark">
      <div className="flex items-end gap-3">
        <span className="rounded-2xl bg-ink px-4 py-3 text-3xl tracking-tight text-lime">{mes ?? "—"}</span>
        <span className="pb-1 text-sm text-ink/60">base em uso agora</span>
      </div>
    </Bento>
  );
}

// ---------------------------------------------------------------------------

function ComoFunciona() {
  const passos = [
    { icone: <Sparkles className="size-5" />, titulo: "Descreva seu cliente ideal", texto: "Em uma frase, ou com os filtros detalhados. Ex.: “clínicas veterinárias em Campinas abertas há mais de 2 anos”." },
    { icone: <Building2 className="size-5" />, titulo: "Explore e selecione", texto: "Mapa de calor, ranking de cidades e segmentos e a lista completa, com telefone, e-mail e endereço." },
    { icone: <KanbanSquare className="size-5" />, titulo: "Aborde e acompanhe", texto: "WhatsApp em um clique, exportação e um funil kanban para não perder nenhum follow-up." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-24">
      <Revelar><Titulo selo="Como funciona" titulo="Da ideia à primeira conversa em minutos" /></Revelar>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {passos.map((p, i) => (
          <Revelar key={p.titulo} atraso={i * 100}>
            <article className="glass relative h-full rounded-[var(--radius-card)] p-6">
              <span className="absolute right-6 top-4 text-[64px] leading-none tracking-tight text-ink/[0.06]">0{i + 1}</span>
              <span className="grid size-12 place-items-center rounded-full bg-lime">{p.icone}</span>
              <h3 className="mt-5 text-xl tracking-tight">{p.titulo}</h3>
              <p className="mt-2 text-sm text-ink/60">{p.texto}</p>
            </article>
          </Revelar>
        ))}
      </div>
    </section>
  );
}

function SecaoIA() {
  return (
    <section id="ia" className="scroll-mt-24">
      <Revelar>
        <div className="relative grid items-center gap-10 overflow-hidden rounded-[var(--radius-panel)] bg-coal p-6 text-white sm:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="pointer-events-none absolute -bottom-40 -left-20 size-[480px] rounded-full bg-lime/15 blur-[120px]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80">
              <Sparkles className="size-3.5 text-lime" /> Automação com IA · ativação com a equipe
            </span>
            <h2 className="mt-5 text-4xl leading-[1.05] tracking-tight sm:text-5xl">Sua lista conversando sozinha no <span className="text-lime">WhatsApp</span>.</h2>
            <p className="mt-4 max-w-lg text-white/65">
              Um agente de IA aborda as empresas que você filtrou, adapta a conversa ao segmento, qualifica o interesse e entrega
              no CRM só quem está pronto para falar com um vendedor.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
              {["Roteiro por segmento (CNAE)", "Horário comercial e limites seguros", "Opt-out e LGPD", "Passa para humano quando precisa"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="size-4 text-lime" />{t}</li>
              ))}
            </ul>
            <Link href="/automacao" className="mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-lime pl-5 pr-1.5 text-sm font-medium text-ink hover:bg-lime-deep">
              Conhecer a automação <span className="grid size-9 place-items-center rounded-full bg-ink text-lime"><ArrowRight className="size-4" /></span>
            </Link>
          </div>
          <Celular />
        </div>
      </Revelar>
    </section>
  );
}

const PERGUNTAS = [
  ["De onde vêm os dados?", "Dos dados abertos do CNPJ publicados pela Receita Federal: razão social, nome fantasia, CNAE, endereço, telefones, e-mail, porte, regime e data de abertura de todas as empresas ativas do país."],
  ["Com que frequência a base é atualizada?", "Todo mês. Assim que a Receita publica a nova base, ela é processada e substitui a anterior sem interromper o uso."],
  ["Posso exportar as empresas?", "Sim. Qualquer busca pode ser exportada em CSV (abre direto no Excel), com até 20 mil empresas por exportação."],
  ["Como fica a LGPD?", "Os dados são públicos e de pessoas jurídicas. Para MEIs, que podem trazer dados do titular, recomendamos abordagem com identificação clara e opção de não ser mais contatado, que é o padrão na automação com IA."],
  ["Preciso instalar alguma coisa?", "Não. Funciona no navegador, no computador e no celular."],
];

function Faq() {
  const [aberta, setAberta] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
      <Revelar><Titulo selo="Dúvidas" titulo="Perguntas frequentes" sub="Não achou o que procurava? Fale com a gente pela página de automação." /></Revelar>
      <Revelar atraso={100} className="flex flex-col gap-2">
        {PERGUNTAS.map(([p, r], i) => (
          <div key={p} className={cx("rounded-3xl transition-colors", aberta === i ? "bg-ink text-white" : "glass")}>
            <button type="button" onClick={() => setAberta(aberta === i ? -1 : i)} aria-expanded={aberta === i}
              className="flex w-full items-center justify-between gap-4 p-5 text-left">
              <span className="font-medium">{p}</span>
              <span className={cx("grid size-8 shrink-0 place-items-center rounded-full transition", aberta === i ? "rotate-180 bg-lime text-ink" : "bg-white/70")}>
                <ChevronDown className="size-4" />
              </span>
            </button>
            <div className={cx("grid transition-[grid-template-rows] duration-300", aberta === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <p className="overflow-hidden px-5 text-sm text-white/70"><span className="block pb-5">{r}</span></p>
            </div>
          </div>
        ))}
      </Revelar>
    </section>
  );
}

function CtaFinal() {
  return (
    <Revelar>
      <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-lime p-8 sm:p-14">
        <div className="hatch-dark pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-2xl text-4xl leading-[1.05] tracking-tight sm:text-6xl">Seu próximo cliente já tem CNPJ. Vamos encontrá-lo?</h2>
          <Link href="/" className="flex h-14 shrink-0 items-center gap-3 rounded-full bg-ink pl-6 pr-2 text-base font-medium text-white hover:bg-coal-2">
            Começar a prospectar <span className="grid size-10 place-items-center rounded-full bg-lime text-ink"><ArrowRight className="size-5" /></span>
          </Link>
        </div>
      </section>
    </Revelar>
  );
}

function Rodape() {
  return (
    <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 pb-10 text-sm text-ink/50 sm:px-6 lg:px-8">
      <span className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-ink text-lime"><Radar className="size-3.5" /></span> radarb2b</span>
      <span>Dados públicos do CNPJ · Receita Federal do Brasil</span>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Utilitários visuais

function Titulo({ selo, titulo, sub }: { selo: string; titulo: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs text-lime"><span className="size-1.5 rounded-full bg-lime" />{selo}</span>
      <h2 className="mt-4 text-4xl leading-[1.05] tracking-tight sm:text-5xl">{titulo}</h2>
      {sub && <p className="mt-3 text-ink/60">{sub}</p>}
    </div>
  );
}

function Flutuante({ children, className, claro }: { children: ReactNode; className?: string; claro?: boolean }) {
  return (
    <div className={cx("absolute z-10 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm shadow-[0_20px_40px_-20px_rgb(20_21_24/0.5)] [animation:flutuar_6s_ease-in-out_infinite]",
      claro ? "glass" : "bg-ink text-white", className)}>
      {children}
    </div>
  );
}

/** Aparece suavemente quando entra na tela. */
function Revelar({ children, atraso = 0, className }: { children: ReactNode; atraso?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisivel(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${atraso}ms` }}
      className={cx("transition-all duration-700 ease-out motion-reduce:transition-none", visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", className)}>
      {children}
    </div>
  );
}

/** Número que conta até o valor quando aparece. */
function Contador({ valor, formato = numero }: { valor: number; formato?: (v: number) => string }) {
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    let raf = 0;
    const inicio = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / 1400);
      setAtual(Math.round(valor * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{formato(atual)}</>;
}

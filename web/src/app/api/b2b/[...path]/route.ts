import type { NextRequest } from "next/server";
import { LIMITES_GRATIS, type Motivo, PAGINAS_AVULSO, POR_PAGINA, chaveBusca } from "@/lib/planos";
import { supabaseServidor } from "@/lib/supabase/server";

// Proxy para a API da VPS: a chave fica só no servidor, nunca no navegador.
// Usuário logado acessa tudo; visitante (landing page) só os agregados e uma prévia de 3 empresas.
const ROTAS = new Set(["empresas", "resumo", "mapa", "municipios", "cnaes", "exportar", "stats"]);
const PUBLICAS = new Set(["resumo", "mapa", "municipios", "cnaes", "stats"]);

function permitidoSemLogin(path: string[], req: NextRequest) {
  if (PUBLICAS.has(path[0]) && path.length === 1) return true;
  // Prévia da landing: lista de empresas com no máximo 3 resultados
  const sp = req.nextUrl.searchParams;
  return path[0] === "empresas" && path.length === 1 && Number(sp.get("limit")) <= 3 && Number(sp.get("page") ?? 1) === 1;
}

// Prévia pública: mascara no servidor o que identifica pessoas (MEIs usam o nome do titular)
const mascararNome = (n: string | null) =>
  n ? n.replace(/^\d{2}\.\d{3}\.\d{3}\s+/, "").split(" ").map((p, i) => (i === 0 ? p : `${p[0] ?? ""}•••`)).join(" ") : n;
const mascararFone = (t: string | null) => (t ? `${t.slice(0, 3)}••••${t.slice(-2)}` : t);
type Linha = Record<string, unknown>;
function anonimizar(corpo: { resultados?: Linha[] }) {
  corpo.resultados = (corpo.resultados ?? []).map((e, i) => ({
    cnpj: `oculto-${i}`, uf: e.uf, municipio: e.municipio, cnae_principal: e.cnae_principal, cnae_descricao: e.cnae_descricao,
    razao_social: mascararNome(e.razao_social as string | null), nome_fantasia: mascararNome(e.nome_fantasia as string | null),
    telefone1: mascararFone(e.telefone1 as string | null), porte: e.porte, situacao: e.situacao,
  }));
  return corpo;
}

// Conta grátis: contatos (telefone, e-mail) só aparecem depois de "abertos" (10 no total)
const mascararContato = (e: Linha) => ({
  ...e,
  telefone1: e.telefone1 ? `${String(e.telefone1).slice(0, 3)}••••${String(e.telefone1).slice(-2)}` : null,
  telefone2: null,
  email: e.email ? `••••@${String(e.email).split("@")[1] ?? ""}` : null,
  contato_bloqueado: true,
});

// Modo de desenvolvimento sem login: só no servidor local (ignorado em produção)
const DEV_SEM_LOGIN = process.env.NODE_ENV !== "production" && process.env.DEV_SEM_LOGIN === "1";

/** 402: a ação precisa de crédito ou plano. O app abre a tela de planos com o motivo. */
const semCredito = (motivo: Motivo, erro: string, chave?: string) =>
  Response.json({ erro, motivo, chave }, { status: 402 });

const api = (caminho: string, signal?: AbortSignal) =>
  fetch(`${process.env.API_URL}/${caminho}`, { headers: { "x-api-key": process.env.API_KEY ?? "" }, cache: "no-store", signal });

export async function GET(req: NextRequest, ctx: RouteContext<"/api/b2b/[...path]">) {
  const { path } = await ctx.params;
  if (!ROTAS.has(path[0])) return Response.json({ erro: "Rota não permitida" }, { status: 404 });

  const supabase = await supabaseServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const logado = DEV_SEM_LOGIN || !!sessao?.claims;
  if (!logado && !permitidoSemLogin(path, req)) {
    return Response.json({ erro: "Faça login para continuar" }, { status: 401 });
  }

  // Regras de crédito (só para logados; o modo dev e quem tem plano passam direto)
  const sp = req.nextUrl.searchParams;
  let mascarar = false;
  // Prévia de 3 (busca da landing) não consome crédito: volta mascarada para todos
  const previa = permitidoSemLogin(path, req) && path[0] === "empresas";
  if (logado && !DEV_SEM_LOGIN && !previa) {
    const usar = async (fn: "usar_pesquisa" | "usar_contato", arg: Record<string, string>) => {
      const { data, error } = await supabase.rpc(fn, arg);
      if (error) throw new Error(error.message);
      return data as "plano" | "avulsa" | "gratis" | "esgotado";
    };
    try {
      if (path[0] === "empresas" && path.length === 1) {
        const chave = chaveBusca(sp);
        const pagina = Number(sp.get("page") ?? 1);
        const r = await usar("usar_pesquisa", { p_chave: chave });
        if (r === "esgotado") return semCredito("pesquisas", `Você usou as ${LIMITES_GRATIS.pesquisas} pesquisas grátis`, chave);
        if (r === "avulsa" && pagina > PAGINAS_AVULSO) return semCredito("paginas_avulso", `A consulta avulsa vai até a página ${PAGINAS_AVULSO}`, chave);
        if (r === "gratis" && pagina > LIMITES_GRATIS.paginas) return semCredito("paginas", `No plano grátis a lista vai até a página ${LIMITES_GRATIS.paginas}`, chave);
        mascarar = r === "gratis";
      } else if (path[0] === "empresas" && path.length === 2) {
        const cnpj = path[1].replace(/\D/g, "");
        // Consulta avulsa: a empresa precisa ser da pesquisa comprada
        const consulta = sp.get("consulta");
        let liberado = false;
        if (consulta && (await usar("usar_pesquisa", { p_chave: consulta })) !== "gratis") {
          const q = new URLSearchParams(consulta);
          q.set("cnpjs", cnpj);
          q.set("limit", "1");
          const conf = await api(`empresas?${q}`).then((x) => x.json()).catch(() => null);
          liberado = (conf?.total ?? 0) > 0;
        }
        if (!liberado && (await usar("usar_contato", { p_cnpj: cnpj })) === "esgotado") {
          return semCredito("contatos", `Você abriu os ${LIMITES_GRATIS.contatos} contatos grátis`);
        }
      } else if (path[0] === "exportar") {
        const chave = chaveBusca(sp);
        const r = await usar("usar_pesquisa", { p_chave: chave });
        if (r === "gratis" || r === "esgotado") return semCredito("exportar", "Exportar a lista faz parte da consulta avulsa e do plano Pro", chave);
        if (r === "avulsa") sp.set("limit", String(PAGINAS_AVULSO * POR_PAGINA));
      }
    } catch (e) {
      return Response.json({ erro: `Não foi possível checar seus créditos: ${(e as Error).message}` }, { status: 503 });
    }
  }

  const res = await api(`${path.map(encodeURIComponent).join("/")}${sp.size ? `?${sp}` : ""}`, req.signal);

  if ((!logado || previa) && path[0] === "empresas" && path.length === 1 && res.ok && !DEV_SEM_LOGIN) {
    return Response.json(anonimizar(await res.json()));
  }
  if (mascarar && res.ok) {
    const corpo = (await res.json()) as { resultados?: Linha[] };
    const cnpjs = (corpo.resultados ?? []).map((e) => String(e.cnpj));
    const { data: revelados } = await supabase.rpc("contatos_revelados", { p_cnpjs: cnpjs });
    const abertos = new Set((revelados as string[] | null) ?? []);
    corpo.resultados = (corpo.resultados ?? []).map((e) => (abertos.has(String(e.cnpj)) ? e : mascararContato(e)));
    return Response.json(corpo);
  }

  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "application/json" });
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(res.body, { status: res.status, headers });
}

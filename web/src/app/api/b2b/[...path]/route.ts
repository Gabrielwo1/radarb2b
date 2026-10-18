import type { NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/supabase/server";

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

export async function GET(req: NextRequest, ctx: RouteContext<"/api/b2b/[...path]">) {
  const { path } = await ctx.params;
  if (!ROTAS.has(path[0])) return Response.json({ erro: "Rota não permitida" }, { status: 404 });
  const logado = !!(await usuarioAtual());
  if (!logado && !permitidoSemLogin(path, req)) {
    return Response.json({ erro: "Faça login para continuar" }, { status: 401 });
  }

  const url = `${process.env.API_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const res = await fetch(url, {
    headers: { "x-api-key": process.env.API_KEY ?? "" },
    cache: "no-store",
    signal: req.signal,
  });

  if (!logado && path[0] === "empresas" && res.ok) return Response.json(anonimizar(await res.json()));

  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "application/json" });
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  return new Response(res.body, { status: res.status, headers });
}

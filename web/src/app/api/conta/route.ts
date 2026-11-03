import { supabaseServidor } from "@/lib/supabase/server";

const DEV_SEM_LOGIN = process.env.NODE_ENV !== "production" && process.env.DEV_SEM_LOGIN === "1";

/** Plano e consumo do usuário logado (componente de créditos no topo do app). */
export async function GET() {
  if (DEV_SEM_LOGIN) {
    return Response.json({ plano: "pro", ciclo: "manual", valido_ate: null, recorrente: false, pesquisas: 0, contatos: 0, avulsas: [] });
  }
  const supabase = await supabaseServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims) return Response.json({ erro: "Faça login" }, { status: 401 });
  const { data, error } = await supabase.rpc("situacao_conta");
  if (error) return Response.json({ erro: error.message }, { status: 500 });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

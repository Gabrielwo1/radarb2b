import { after } from "next/server";
import { enviarEmail } from "@/lib/emails/enviar";
import { LIMITES_GRATIS, type Situacao } from "@/lib/planos";
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

  // E-mails únicos disparados pelo uso: boas-vindas e aviso de créditos (depois da resposta, sem atrasar o app)
  const c = sessao.claims;
  const conta = data as Situacao;
  after(async () => {
    await supabase.rpc("registrar_acesso"); // gráfico de acessos do painel /admin
    const email = c.email as string | undefined;
    const nome = (c.user_metadata as { nome?: string } | undefined)?.nome;
    const enviarUmaVez = async (tipo: "boas_vindas" | "creditos_acabando" | "gratis_esgotado") => {
      const { data: novo } = await supabase.rpc("marcar_email", { p_tipo: tipo });
      if (novo) await enviarEmail(email, tipo, { nome });
    };
    await enviarUmaVez("boas_vindas");
    if (conta.plano === "gratis" && conta.pesquisas >= LIMITES_GRATIS.pesquisas) await enviarUmaVez("gratis_esgotado");
    else if (conta.plano === "gratis" && conta.pesquisas === LIMITES_GRATIS.pesquisas - 1) await enviarUmaVez("creditos_acabando");
  });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

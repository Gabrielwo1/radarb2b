import { dataBr, enviarEmail } from "@/lib/emails/enviar";
import { mp, registrarAssinatura } from "@/lib/mercadopago";
import { supabaseServidor } from "@/lib/supabase/server";

/** Cancela a renovação automática. O acesso continua até o fim do período já pago. */
export async function DELETE() {
  const supabase = await supabaseServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims) return Response.json({ erro: "Faça login" }, { status: 401 });
  const { data } = await supabase.from("assinaturas").select("mp_preapproval_id, valido_ate").maybeSingle();
  const id = data?.mp_preapproval_id as string | undefined;
  if (!id) return Response.json({ erro: "Nenhuma assinatura recorrente ativa" }, { status: 404 });
  try {
    await mp(`/preapproval/${id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
    await registrarAssinatura(sessao.claims.sub as string, id, "cancelled");
    await enviarEmail(sessao.claims.email as string | undefined, "renovacao_cancelada", {
      nome: (sessao.claims.user_metadata as { nome?: string } | undefined)?.nome,
      ate: dataBr(data?.valido_ate as string | undefined),
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 502 });
  }
}

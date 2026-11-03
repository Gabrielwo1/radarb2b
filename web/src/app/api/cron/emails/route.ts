import { dataBr, enviarEmail, linkDescadastro, supabaseSemSessao } from "@/lib/emails/enviar";
import type { TipoEmail } from "@/lib/emails/modelos";

// E-mails de relacionamento: roda 1x por dia (Vercel Cron, vercel.json) e envia o que estiver na fila.
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  const supabase = supabaseSemSessao();
  const segredo = process.env.PAGAMENTOS_SEGREDO;
  const { data: fila, error } = await supabase.rpc("fila_emails", { p_segredo: segredo });
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const enviados: Record<string, number> = {};
  for (const f of (fila ?? []) as { user_id: string; email: string; nome: string; tipo: TipoEmail; ref: string; ate: string | null }[]) {
    // Marca antes de enviar: se o cron rodar duas vezes, ninguém recebe repetido
    const { data: novo } = await supabase.rpc("registrar_email", { p_segredo: segredo, p_user: f.user_id, p_tipo: f.tipo, p_ref: f.ref });
    if (!novo) continue;
    const ok = await enviarEmail(f.email, f.tipo, { nome: f.nome, ate: dataBr(f.ate), descadastro: linkDescadastro(f.user_id) });
    if (ok) enviados[f.tipo] = (enviados[f.tipo] ?? 0) + 1;
  }
  return Response.json({ fila: fila?.length ?? 0, enviados });
}

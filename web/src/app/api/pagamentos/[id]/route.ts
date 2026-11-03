import { type Pagamento, aplicarPagamento, lerReferencia, mp } from "@/lib/mercadopago";
import { usuarioAtual } from "@/lib/supabase/server";

/** Situação de um pagamento (o checkout consulta enquanto o Pix não é pago). Libera o plano se já aprovado. */
export async function GET(_req: Request, ctx: RouteContext<"/api/pagamentos/[id]">) {
  const usuario = await usuarioAtual();
  if (!usuario) return Response.json({ erro: "Faça login" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const p = await mp<Pagamento>(`/v1/payments/${encodeURIComponent(id)}`);
    if (lerReferencia(p.external_reference)?.user !== usuario.id) return Response.json({ erro: "Pagamento não encontrado" }, { status: 404 });
    if (p.status === "approved") await aplicarPagamento(p);
    return Response.json({ status: p.status, detalhe: p.status_detail }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 502 });
  }
}

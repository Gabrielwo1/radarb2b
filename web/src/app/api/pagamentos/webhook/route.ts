import { createHmac, timingSafeEqual } from "node:crypto";
import { type Pagamento, aplicarPagamento, lerReferencia, mp, registrarAssinatura } from "@/lib/mercadopago";

// Notificações do Mercado Pago. Nunca confia no corpo: sempre busca o pagamento/assinatura na API antes de liberar.
// Se MP_WEBHOOK_SECRET estiver definido, confere também a assinatura (x-signature).

function assinaturaValida(req: Request, dataId: string) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  if (!segredo) return true;
  const partes = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const manifesto = `id:${dataId.toLowerCase()};request-id:${req.headers.get("x-request-id") ?? ""};ts:${partes.ts};`;
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");
  return esperado.length === partes.v1.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}

type Preapproval = { id: string; status: string; external_reference: string | null };

export async function POST(req: Request) {
  const url = new URL(req.url);
  const corpo = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string } };
  const tipo = corpo.type ?? corpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = String(corpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!id) return Response.json({ ok: true });
  if (!assinaturaValida(req, id)) return Response.json({ erro: "assinatura inválida" }, { status: 401 });

  try {
    if (tipo === "payment") {
      const p = await mp<Pagamento & { operation_type?: string }>(`/v1/payments/${id}`);
      // Cobranças da assinatura chegam pelo tópico subscription_authorized_payment
      if (p.operation_type !== "recurring_payment") await aplicarPagamento(p);
    } else if (tipo === "subscription_authorized_payment") {
      const cobranca = await mp<{ preapproval_id: string; payment?: { id: number } }>(`/authorized_payments/${id}`);
      if (cobranca.payment?.id) {
        const assinatura = await mp<Preapproval>(`/preapproval/${cobranca.preapproval_id}`);
        const p = await mp<Pagamento>(`/v1/payments/${cobranca.payment.id}`);
        await aplicarPagamento({ ...p, external_reference: assinatura.external_reference }, assinatura.id);
      }
    } else if (tipo === "subscription_preapproval") {
      const assinatura = await mp<Preapproval>(`/preapproval/${id}`);
      const ref = lerReferencia(assinatura.external_reference);
      if (ref) await registrarAssinatura(ref.user, assinatura.id, assinatura.status);
    }
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo mais tarde
    return Response.json({ erro: (e as Error).message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

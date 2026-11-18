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

// Mesma conta do Mercado Pago para Radar e Fluxa, e o painel aceita um só webhook (o do Radar).
// Avisos que não são do Radar seguem para o Fluxa, com os mesmos cabeçalhos (a assinatura continua válida lá).
const FLUXA_WEBHOOK = process.env.FLUXA_WEBHOOK_URL ?? "https://fluxa-wine.vercel.app/api/billing/webhook";

async function encaminharFluxa(req: Request, corpo: string) {
  const url = new URL(FLUXA_WEBHOOK);
  url.search = new URL(req.url).search;
  const headers: Record<string, string> = { "content-type": req.headers.get("content-type") ?? "application/json" };
  for (const h of ["x-signature", "x-request-id"]) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }
  const r = await fetch(url, { method: "POST", headers, body: corpo, cache: "no-store" }).catch(() => null);
  // Se o Fluxa falhar, devolvemos erro para o Mercado Pago tentar de novo
  if (!r || r.status >= 500) throw new Error("Fluxa indisponível");
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const bruto = await req.text();
  const corpo = (() => { try { return JSON.parse(bruto); } catch { return {}; } })() as { type?: string; topic?: string; data?: { id?: string } };
  const tipo = corpo.type ?? corpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = String(corpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!id) return Response.json({ ok: true });
  if (!assinaturaValida(req, id)) return Response.json({ erro: "assinatura inválida" }, { status: 401 });

  try {
    if (tipo === "payment") {
      const p = await mp<Pagamento & { operation_type?: string }>(`/v1/payments/${id}`);
      if (!lerReferencia(p.external_reference) && p.operation_type !== "recurring_payment") await encaminharFluxa(req, bruto);
      // Cobranças da assinatura chegam pelo tópico subscription_authorized_payment
      else if (p.operation_type !== "recurring_payment") await aplicarPagamento(p);
    } else if (tipo === "subscription_authorized_payment") {
      const cobranca = await mp<{ preapproval_id: string; payment?: { id: number } }>(`/authorized_payments/${id}`);
      const assinatura = await mp<Preapproval>(`/preapproval/${cobranca.preapproval_id}`);
      if (!lerReferencia(assinatura.external_reference)) await encaminharFluxa(req, bruto);
      else if (cobranca.payment?.id) {
        const p = await mp<Pagamento>(`/v1/payments/${cobranca.payment.id}`);
        await aplicarPagamento({ ...p, external_reference: assinatura.external_reference }, assinatura.id);
      }
    } else if (tipo === "subscription_preapproval") {
      const assinatura = await mp<Preapproval>(`/preapproval/${id}`);
      const ref = lerReferencia(assinatura.external_reference);
      if (ref) await registrarAssinatura(ref.user, assinatura.id, assinatura.status);
      else await encaminharFluxa(req, bruto);
    } else {
      await encaminharFluxa(req, bruto); // tópicos que o Radar não usa
    }
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo mais tarde
    return Response.json({ erro: (e as Error).message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

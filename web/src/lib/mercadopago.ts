import { createClient } from "@supabase/supabase-js";
import { PRECOS, type TipoCompra } from "./planos";

// Mercado Pago (checkout transparente): o navegador gera o token do cartão / escolhe Pix com os Bricks,
// e o servidor cria o pagamento com o preço definido aqui (nunca o valor vindo do navegador).

const API = "https://api.mercadopago.com";

export async function mp<T = Record<string, unknown>>(caminho: string, init?: RequestInit & { idempotencia?: string }): Promise<T> {
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "content-type": "application/json",
      ...(init?.idempotencia ? { "X-Idempotency-Key": init.idempotencia } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = corpo?.message ?? corpo?.cause?.[0]?.description ?? `Mercado Pago: HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status, corpo });
  }
  return corpo as T;
}

export type Pagamento = {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  payment_method_id: string;
  external_reference: string | null;
  date_approved: string | null;
  date_created: string;
  metadata?: Record<string, unknown>;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
};

/** external_reference = "usuario|tipo|chave" */
export const referencia = (user: string, tipo: TipoCompra, chave?: string | null) => `${user}|${tipo}|${chave ?? ""}`;
export function lerReferencia(ref: string | null | undefined) {
  const [user, tipo, ...resto] = (ref ?? "").split("|");
  if (!user || !(tipo in PRECOS)) return null;
  return { user, tipo: tipo as TipoCompra, chave: resto.join("|") || null };
}

/** Cliente sem sessão (usado pelo webhook): a liberação é protegida pelo segredo do servidor. */
const supabaseServico = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Grava o pagamento e libera o plano se aprovado (idempotente: o mesmo pagamento só libera uma vez). */
export async function aplicarPagamento(p: Pagamento, preapproval?: string | null) {
  const ref = lerReferencia(p.external_reference);
  if (!ref) return false;
  // Confere o valor: só libera se o que foi pago bate com o preço do plano
  if (p.status === "approved" && p.transaction_amount + 0.001 < PRECOS[ref.tipo].valor) return false;
  const { data, error } = await supabaseServico().rpc("registrar_pagamento", {
    p_segredo: process.env.PAGAMENTOS_SEGREDO,
    p_id: String(p.id),
    p_user: ref.user,
    p_tipo: ref.tipo,
    p_valor: p.transaction_amount,
    p_status: p.status,
    p_metodo: p.payment_method_id,
    p_chave: ref.chave,
    p_preapproval: preapproval ?? null,
    p_data: p.date_approved ?? p.date_created,
  });
  if (error) throw new Error(error.message);
  return data as boolean;
}

export async function registrarAssinatura(user: string, preapproval: string, status: string) {
  const { error } = await supabaseServico().rpc("registrar_assinatura", {
    p_segredo: process.env.PAGAMENTOS_SEGREDO, p_user: user, p_preapproval: preapproval, p_status: status,
  });
  if (error) throw new Error(error.message);
}

export const urlSite = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.b2bradar.pro";

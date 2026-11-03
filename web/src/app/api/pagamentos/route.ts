import { randomUUID } from "node:crypto";
import { type Pagamento, aplicarPagamento, mp, referencia, registrarAssinatura, urlSite } from "@/lib/mercadopago";
import { PRECOS, type TipoCompra } from "@/lib/planos";
import { supabaseServidor } from "@/lib/supabase/server";

// Cria o pagamento com os dados do Payment Brick (cartão ou Pix).
// Pro mensal no cartão vira assinatura recorrente (preapproval); no Pix vale 30 dias.

type Corpo = {
  tipo: TipoCompra;
  chave?: string | null;
  metodo: "credit_card" | "debit_card" | "bank_transfer";
  dados: {
    token?: string;
    issuer_id?: string;
    payment_method_id: string;
    installments?: number;
    payer?: { email?: string; identification?: { type: string; number: string }; first_name?: string; last_name?: string };
  };
};

export async function POST(req: Request) {
  const supabase = await supabaseServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const claims = sessao?.claims;
  if (!claims) return Response.json({ erro: "Faça login para assinar" }, { status: 401 });
  const user = claims.sub as string;

  const corpo = (await req.json().catch(() => null)) as Corpo | null;
  if (!corpo || !(corpo.tipo in PRECOS) || !corpo.dados?.payment_method_id) {
    return Response.json({ erro: "Dados de pagamento incompletos" }, { status: 400 });
  }
  const preco = PRECOS[corpo.tipo];
  const chave = corpo.tipo === "avulso" ? (corpo.chave ?? "").slice(0, 2000) : null;
  if (corpo.tipo === "avulso" && !chave) return Response.json({ erro: "Escolha a pesquisa que quer liberar" }, { status: 400 });
  const email = corpo.dados.payer?.email || (claims.email as string | undefined);
  const ref = referencia(user, corpo.tipo, chave);

  try {
    // Mensal no cartão de crédito: assinatura recorrente
    if (corpo.tipo === "pro_mensal" && corpo.metodo === "credit_card" && corpo.dados.token) {
      const assinatura = await mp<{ id: string; status: string }>("/preapproval", {
        method: "POST",
        idempotencia: randomUUID(),
        body: JSON.stringify({
          reason: preco.titulo,
          external_reference: ref,
          payer_email: email,
          card_token_id: corpo.dados.token,
          auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: preco.valor, currency_id: "BRL" },
          back_url: `${urlSite()}/planos`,
          status: "authorized",
        }),
      });
      if (assinatura.status === "authorized") await registrarAssinatura(user, assinatura.id, "authorized");
      return Response.json({ status: assinatura.status === "authorized" ? "approved" : "rejected", assinatura: assinatura.id });
    }

    const pagamento = await mp<Pagamento>("/v1/payments", {
      method: "POST",
      idempotencia: randomUUID(),
      body: JSON.stringify({
        transaction_amount: preco.valor,
        description: preco.titulo,
        payment_method_id: corpo.dados.payment_method_id,
        token: corpo.dados.token,
        issuer_id: corpo.dados.issuer_id,
        installments: Math.min(Math.max(Number(corpo.dados.installments) || 1, 1), preco.parcelas),
        payer: { email, identification: corpo.dados.payer?.identification, first_name: corpo.dados.payer?.first_name, last_name: corpo.dados.payer?.last_name },
        external_reference: ref,
        notification_url: `${urlSite()}/api/pagamentos/webhook`,
        statement_descriptor: "RADARB2B",
        metadata: { user_id: user, tipo: corpo.tipo },
      }),
    });
    await aplicarPagamento(pagamento);
    const pix = pagamento.point_of_interaction?.transaction_data;
    return Response.json({
      id: pagamento.id,
      status: pagamento.status,
      detalhe: pagamento.status_detail,
      pix: pix?.qr_code ? { copiaECola: pix.qr_code, qr: pix.qr_code_base64 } : null,
    });
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 502 });
  }
}

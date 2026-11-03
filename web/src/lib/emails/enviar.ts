import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { type Dados, type TipoEmail, modeloEmail } from "./modelos";

// Envio pelo Resend. Falha de e-mail nunca derruba a ação principal (pagamento, cadastro...): só registra no log.

const REMETENTE = process.env.EMAIL_REMETENTE ?? "Radar B2B <ola@b2bradar.pro>";
const RESPOSTA = process.env.EMAIL_RESPOSTA; // ex.: contato@b2bradar.pro (respostas dos clientes)

export async function enviarEmail(para: string | null | undefined, tipo: TipoEmail, dados: Dados = {}) {
  if (!para || !process.env.RESEND_API_KEY) return false;
  const { assunto, html } = modeloEmail(tipo, dados);
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE,
        to: [para],
        subject: assunto,
        html,
        ...(RESPOSTA ? { reply_to: RESPOSTA } : {}),
        tags: [{ name: "tipo", value: tipo }],
        ...(dados.descadastro ? { headers: { "List-Unsubscribe": `<${dados.descadastro}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }),
    });
    if (!r.ok) console.error(`e-mail ${tipo}: Resend ${r.status} ${await r.text()}`);
    return r.ok;
  } catch (e) {
    console.error(`e-mail ${tipo}:`, e);
    return false;
  }
}

/** Link de descadastro assinado (não dá para descadastrar outra pessoa trocando o id). */
export function linkDescadastro(user: string) {
  const t = createHmac("sha256", process.env.PAGAMENTOS_SEGREDO ?? "").update(`sair:${user}`).digest("hex").slice(0, 32);
  return `https://www.b2bradar.pro/api/emails/sair?u=${user}&t=${t}`;
}
export const descadastroValido = (user: string, t: string) => !!t && linkDescadastro(user).endsWith(`&t=${t}`);

/** Cliente sem sessão para as funções protegidas pelo segredo do servidor. */
export const supabaseSemSessao = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const dataBr = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : undefined);

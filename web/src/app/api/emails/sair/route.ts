import { descadastroValido, supabaseSemSessao } from "@/lib/emails/enviar";

// Descadastro das dicas por e-mail (link no rodapé e cabeçalho List-Unsubscribe)
async function sair(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(u) || !descadastroValido(u, url.searchParams.get("t") ?? "")) {
    return new Response("Link inválido.", { status: 400 });
  }
  const { error } = await supabaseSemSessao().rpc("sair_emails", { p_segredo: process.env.PAGAMENTOS_SEGREDO, p_user: u });
  if (error) return new Response("Não foi possível concluir agora. Tente de novo mais tarde.", { status: 500 });
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pronto</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#EEF2F8;font-family:Helvetica,Arial,sans-serif;color:#141518">
<div style="max-width:420px;padding:32px;background:#fff;border-radius:28px;text-align:center">
<h1 style="font-weight:500;font-size:24px;margin:0 0 8px">Pronto, você não vai mais receber nossas dicas.</h1>
<p style="color:#6B7079;margin:0 0 20px">E-mails sobre sua conta e pagamentos continuam chegando normalmente.</p>
<a href="https://www.b2bradar.pro/app" style="display:inline-block;background:#E3FC3F;color:#141518;padding:12px 22px;border-radius:99px;text-decoration:none;font-weight:600">Voltar ao Radar</a></div>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
export const GET = sair;
export const POST = sair; // descadastro em 1 clique (Gmail/Apple Mail)

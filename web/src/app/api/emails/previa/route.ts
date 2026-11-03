import { type TipoAuth, type TipoEmail, modeloAuth, modeloEmail } from "@/lib/emails/modelos";

// Prévia dos e-mails no navegador (só em desenvolvimento): /api/emails/previa?tipo=boas_vindas
export function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Não encontrado", { status: 404 });
  const tipo = new URL(req.url).searchParams.get("tipo") ?? "boas_vindas";
  const auth = ["confirmacao", "recuperacao", "troca_email"].includes(tipo);
  const { assunto, html } = auth
    ? modeloAuth(tipo as TipoAuth)
    : modeloEmail(tipo as TipoEmail, {
        nome: "Gabriel", pix: "00020126580014br.gov.bcb.pix0136exemplo-de-codigo-pix-copia-e-cola5204000053039865406712.805802BR",
        valor: "R$ 712,80", ciclo: "anual", ate: "15/12/2026", descadastro: "https://www.b2bradar.pro/api/emails/sair?exemplo",
      });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "x-assunto": encodeURIComponent(assunto) } });
}

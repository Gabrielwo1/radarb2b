// Layout dos e-mails do Radar B2B: tabelas e estilos inline (funciona no Gmail, Outlook e Apple Mail).
// Identidade: painel carvão #141518, destaque lime #E3FC3F, fundo azul-gelo, botões em pílula.

export const COR = { carvao: "#141518", lime: "#E3FC3F", fundo: "#EEF2F8", texto: "#2A2B2E", suave: "#6B7079", linha: "#E4E8EF" };
const FONTE = "'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif";

export const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Bloco =
  | { tipo: "texto"; html: string }
  | { tipo: "botao"; texto: string; url: string }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "destaque"; titulo: string; texto: string }
  | { tipo: "numeros"; itens: { valor: string; rotulo: string }[] }
  | { tipo: "codigo"; rotulo: string; valor: string }
  | { tipo: "exemplos"; itens: { texto: string; url: string }[] };

export function montarEmail({ preheader, selo, titulo, blocos, rodape, descadastro }: {
  preheader: string;
  selo?: string;
  titulo: string;
  blocos: Bloco[];
  rodape?: string;
  /** Link de descadastro (só e-mails de relacionamento) */
  descadastro?: string;
}) {
  const corpo = blocos.map(bloco).join("\n");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${COR.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 8px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:34px;height:34px;border-radius:17px;background:${COR.carvao};text-align:center;vertical-align:middle;">
          <span style="display:inline-block;width:12px;height:12px;border:3px solid ${COR.lime};border-radius:9px;"></span>
        </td>
        <td style="padding-left:10px;font:600 18px ${FONTE};color:${COR.carvao};">radar<span style="color:#8A8F98;">b2b</span></td>
      </tr></table>
    </td></tr>

    <tr><td style="background:${COR.carvao};border-radius:28px 28px 0 0;padding:34px 32px 30px;">
      ${selo ? `<span style="display:inline-block;background:${COR.lime};color:${COR.carvao};font:500 12px ${FONTE};padding:5px 12px;border-radius:99px;">${esc(selo)}</span>` : ""}
      <h1 style="margin:${selo ? "16px" : "0"} 0 0;font:500 28px/1.2 ${FONTE};color:#FFFFFF;letter-spacing:-0.4px;">${titulo}</h1>
    </td></tr>

    <tr><td style="background:#FFFFFF;border-radius:0 0 28px 28px;padding:28px 32px 32px;font:400 15px/1.6 ${FONTE};color:${COR.texto};">
      ${corpo}
    </td></tr>

    <tr><td style="padding:22px 16px 0;text-align:center;font:400 12px/1.6 ${FONTE};color:${COR.suave};">
      ${rodape ?? "Radar B2B · As empresas que compram de você, com dados oficiais da Receita Federal."}<br>
      <a href="https://www.b2bradar.pro" style="color:${COR.suave};">b2bradar.pro</a>
      ${descadastro ? ` · <a href="${descadastro}" style="color:${COR.suave};">Não quero mais receber estas dicas</a>` : ""}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

function bloco(b: Bloco): string {
  switch (b.tipo) {
    case "texto":
      return `<p style="margin:0 0 16px;">${b.html}</p>`;
    case "botao":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>
        <td style="background:${COR.lime};border-radius:99px;">
          <a href="${b.url}" style="display:inline-block;padding:14px 26px;font:600 15px ${FONTE};color:${COR.carvao};text-decoration:none;">${esc(b.texto)} &rarr;</a>
        </td></tr></table>`;
    case "lista":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${b.itens
        .map((i) => `<tr><td style="width:26px;vertical-align:top;padding:3px 0;">
          <span style="display:inline-block;width:18px;height:18px;border-radius:9px;background:${COR.carvao};color:${COR.lime};font:600 11px/18px ${FONTE};text-align:center;">&#10003;</span></td>
          <td style="padding:2px 0 6px;">${i}</td></tr>`)
        .join("")}</table>`;
    case "destaque":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr>
        <td style="background:${COR.fundo};border-radius:20px;padding:18px 20px;">
          <p style="margin:0 0 4px;font:600 15px ${FONTE};color:${COR.carvao};">${b.titulo}</p>
          <p style="margin:0;font:400 14px/1.55 ${FONTE};color:${COR.texto};">${b.texto}</p>
        </td></tr></table>`;
    case "numeros":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;"><tr>${b.itens
        .map((n) => `<td style="background:${COR.carvao};border-radius:18px;padding:16px;text-align:center;width:${Math.floor(100 / b.itens.length)}%;">
          <p style="margin:0;font:500 24px ${FONTE};color:${COR.lime};">${esc(n.valor)}</p>
          <p style="margin:4px 0 0;font:400 12px ${FONTE};color:#B9BDC4;">${esc(n.rotulo)}</p></td>`)
        .join(`<td style="width:8px;"></td>`)}</tr></table>`;
    case "codigo":
      return `<p style="margin:0 0 6px;font:500 13px ${FONTE};color:${COR.suave};">${esc(b.rotulo)}</p>
        <p style="margin:0 0 20px;padding:14px 16px;background:${COR.fundo};border-radius:14px;font:400 12px/1.5 Menlo,Consolas,monospace;color:${COR.carvao};word-break:break-all;">${esc(b.valor)}</p>`;
    case "exemplos":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${b.itens
        .map((e) => `<tr><td style="padding:0 0 8px;"><a href="${e.url}" style="display:block;padding:12px 16px;border:1px solid ${COR.linha};border-radius:16px;font:400 14px ${FONTE};color:${COR.carvao};text-decoration:none;">&#10022;&nbsp; ${esc(e.texto)} <span style="color:${COR.suave};">&rarr;</span></a></td></tr>`)
        .join("")}</table>`;
  }
}

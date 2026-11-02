import { ImageResponse } from "next/og";
import retrato from "@/lib/retrato-landing.json";
import { escala } from "@/lib/formato";

// Imagem de compartilhamento (WhatsApp, LinkedIn, anúncios), gerada no build.
export const alt = "Radar B2B — Encontre as empresas que compram de você";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Imagem() {
  const total = escala(retrato.resumos.BR.total);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #eef2f8 0%, #f7f8fb 55%, #eefbb8 100%)", color: "#141518" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: "#141518", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, border: "5px solid #E3FC3F" }} />
          </div>
          radar<span style={{ color: "#7a8089" }}>b2b</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: -2, maxWidth: 900 }}>Encontre as empresas que compram de você.</div>
          <div style={{ display: "flex", fontSize: 32, color: "#4b5058" }}>{`${total} de empresas ativas · filtros por cidade e segmento · WhatsApp e CRM`}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["Dados da Receita Federal", "27 estados", "Busca por linguagem natural"].map((t, i) => (
            <div key={t} style={{ display: "flex", padding: "12px 24px", borderRadius: 40, fontSize: 24, background: i === 0 ? "#141518" : "#E3FC3F", color: i === 0 ? "#E3FC3F" : "#141518" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

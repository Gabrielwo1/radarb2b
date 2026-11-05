import type { ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

// Fundo em camadas para dar acabamento: imagem 3D (Freepik) com zoom lento de câmera, manchas de luz
// em movimento, grade de pontos do design system, granulação de filme e vinheta.
// "problema" = frio e enevoado; "solucao" = escuro com luz lime.

export type TipoFundo = "problema" | "solucao";

const LUZ = { problema: "120,140,170", solucao: "227,252,63" };

export function Fundo({ tipo, intensidade = 1 }: { tipo: TipoFundo; intensidade?: number }) {
  const frame = useCurrentFrame();
  const zoom = 1.12 - Math.min(frame, 300) * 0.0003; // aproximação lenta, sem parar
  const derivaX = Math.sin(frame / 90) * 18;
  const derivaY = Math.cos(frame / 110) * 14;
  const luz = LUZ[tipo];
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#141518" }}>
      <Img src={staticFile(`fundos/${tipo}.jpg`)} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${zoom}) translate(${derivaX * 0.3}px, ${derivaY * 0.3}px)`,
        opacity: tipo === "problema" ? 0.75 : 0.9 * intensidade,
        filter: tipo === "problema" ? "saturate(0.6) brightness(0.8)" : "none",
      }} />
      {/* manchas de luz em movimento */}
      <div style={{ position: "absolute", left: 140 + derivaX * 4, top: 260 + derivaY * 3, width: 700, height: 700, borderRadius: "50%",
        background: `rgba(${luz},${tipo === "solucao" ? 0.16 : 0.12})`, filter: "blur(150px)" }} />
      <div style={{ position: "absolute", right: 60 - derivaX * 3, bottom: 300 - derivaY * 4, width: 620, height: 620, borderRadius: "50%",
        background: `rgba(${tipo === "solucao" ? "61,74,92" : luz},0.2)`, filter: "blur(160px)" }} />
      {/* grade de pontos (padrão do app), mais forte nas bordas */}
      <AbsoluteFill style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.11) 1.6px, transparent 1.7px)",
        backgroundSize: "34px 34px", backgroundPosition: `${frame * 0.15}px ${frame * 0.3}px`,
        WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 50%, transparent 30%, black 100%)",
        maskImage: "radial-gradient(ellipse 70% 55% at 50% 50%, transparent 30%, black 100%)",
        opacity: 0.55,
      }} />
      {/* leitura: escurece o miolo levemente para o texto */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(20,21,24,0.35) 0%, rgba(20,21,24,0.15) 40%, rgba(20,21,24,0.45) 100%)" }} />
      <Granulacao />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)" }} />
    </AbsoluteFill>
  );
}

/** Granulação de filme animada (muda a semente a cada 2 frames). */
function Granulacao() {
  const frame = useCurrentFrame();
  const semente = Math.floor(frame / 2) % 50;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.16, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`grao${semente}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={semente} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grao${semente})`} />
      </svg>
    </AbsoluteFill>
  );
}

/** Cena com fundo próprio e entrada suave (zoom + desfoque), no lugar do corte seco. */
export function Cena({ tipo, children, sem = false }: { tipo: TipoFundo; children: ReactNode; sem?: boolean }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      {!sem && <Fundo tipo={tipo} />}
      <AbsoluteFill style={{ opacity: p, transform: `scale(${1.05 - p * 0.05})`, filter: `blur(${(1 - p) * 14}px)` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

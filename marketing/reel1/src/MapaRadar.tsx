import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import pontos from "../public/pontos-br.json";

// Mapa do Brasil com os 5.572 municípios reais (mesmo arquivo da landing: [lat×100, lng×100, total, ...]).
// "apagado": pontos cinza quase invisíveis (o problema). "varredura": o radar gira e acende as empresas.

const L = 1080, A = 1920;
const LIM = { oeste: -74.2, leste: -34.6, norte: 5.4, sul: -33.9 };
const LIME = "227,252,63";

export function MapaRadar({ modo }: { modo: "apagado" | "varredura" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();

  // Projeção e pesos calculados uma vez
  const dados = useMemo(() => {
    const p = pontos as number[];
    const kx = Math.cos((-14 * Math.PI) / 180);
    const larg = (LIM.leste - LIM.oeste) * kx, alt = LIM.norte - LIM.sul;
    const esc = Math.min((L * 0.94) / larg, (A * 0.62) / alt);
    const x0 = (L - larg * esc) / 2, y0 = A * 0.52 - (alt * esc) / 2;
    const cx = L / 2, cy = A * 0.52;
    const n = p.length / 3;
    let maxLog = 1;
    for (let i = 0; i < n; i++) maxLog = Math.max(maxLog, Math.log1p(p[i * 3 + 2]));
    const lista = Array.from({ length: n }, (_, i) => {
      const x = x0 + (p[i * 3 + 1] / 100 - LIM.oeste) * kx * esc;
      const y = y0 + (LIM.norte - p[i * 3] / 100) * esc;
      // ângulo a partir do "12 horas", no sentido horário, para a varredura
      const ang = (Math.atan2(y - cy, x - cx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      return { x, y, peso: (Math.log1p(p[i * 3 + 2]) / maxLog) ** 2, ang };
    }).sort((a, b) => a.peso - b.peso);
    return { lista, cx, cy, esc };
  }, []);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, L, A);
    const { lista, cx, cy } = dados;

    if (modo === "apagado") {
      for (const p of lista) {
        ctx.fillStyle = `rgba(120,128,140,${0.12 + p.peso * 0.25})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6 + p.peso * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // Varredura: 1 volta a cada 2,2 s; o que já foi varrido fica aceso
    const giro = (frame / 66) * Math.PI * 2;
    const voltaAtual = giro % (Math.PI * 2);
    for (const p of lista) {
      const aceso = giro >= Math.PI * 2 || p.ang <= giro;
      if (!aceso) {
        ctx.fillStyle = "rgba(120,128,140,0.15)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // brilho extra logo atrás do feixe
      const atras = (voltaAtual - p.ang + Math.PI * 2) % (Math.PI * 2);
      const flash = Math.max(0, 1 - atras / 0.9);
      if (p.peso > 0.5) {
        const r = 10 + p.peso * 34 + flash * 10;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, p.peso > 0.8 ? "rgba(20,21,24,0.95)" : `rgba(${LIME},1)`);
        g.addColorStop(0.35, `rgba(${LIME},0.8)`);
        g.addColorStop(1, `rgba(${LIME},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.peso > 0.22 || flash > 0.3 ? `rgba(${LIME},${0.45 + p.peso + flash * 0.4})` : `rgba(170,182,196,${0.35 + p.peso})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + p.peso * 5 + flash * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // anéis e feixe do radar
    ctx.strokeStyle = `rgba(${LIME},0.18)`;
    ctx.lineWidth = 2;
    for (const r of [180, 340, 500]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const feixe = voltaAtual - Math.PI / 2;
    const cone = ctx.createConicGradient ? ctx.createConicGradient(feixe - 0.9, cx, cy) : null;
    if (cone) {
      cone.addColorStop(0, `rgba(${LIME},0)`);
      cone.addColorStop(0.143, `rgba(${LIME},0.28)`);
      cone.addColorStop(0.1431, `rgba(${LIME},0)`);
      cone.addColorStop(1, `rgba(${LIME},0)`);
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.arc(cx, cy, 760, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(${LIME},0.9)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(feixe) * 760, cy + Math.sin(feixe) * 760);
    ctx.stroke();
  }, [frame, modo, dados]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={L} height={A} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
}

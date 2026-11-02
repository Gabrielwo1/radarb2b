"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { numero } from "@/lib/formato";

// Mapa de calor do Brasil desenhado em canvas a partir dos 5.572 municípios (arquivo estático).
// Substitui o MapLibre na landing: sem biblioteca de mapa, sem tiles, pronto em poucos milissegundos.

const ARQUIVO = "/dados/pontos-br.json";
const LIMITES = { oeste: -74.2, leste: -34.6, norte: 5.4, sul: -33.9 };

export function MapaBrasil({ municipios }: { municipios: number }) {
  preload(ARQUIVO, { as: "fetch", crossOrigin: "anonymous" });
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pontos, setPontos] = useState<number[] | null>(null);

  useEffect(() => {
    fetch(ARQUIVO).then((r) => r.json()).then(setPontos).catch(() => {});
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !pontos) return;
    const desenhar = () => desenharMapa(el, pontos);
    desenhar();
    const ro = new ResizeObserver(desenhar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pontos]);

  return (
    <section className="glass relative h-full overflow-hidden rounded-[var(--radius-card)] p-2">
      <div className="hatch absolute inset-2 overflow-hidden rounded-[22px] bg-white/40">
        <canvas
          ref={canvas}
          aria-label="Mapa de calor das empresas ativas por município no Brasil"
          role="img"
          className={`size-full transition-opacity duration-700 ${pontos ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      <div className="glass absolute left-5 top-5 rounded-3xl px-4 py-3">
        <p className="text-xs text-muted">Mapa de calor · Brasil</p>
        <p className="text-lg leading-tight">{numero(municipios)} cidades</p>
        <p className="text-xs text-ink/60">maior polo: São Paulo</p>
      </div>

      <Link href="/app?uf=BR" className="absolute right-5 top-5 flex h-10 items-center gap-1.5 rounded-full bg-ink pl-4 pr-1.5 text-xs text-white transition hover:bg-coal-2">
        Explorar no app <span className="grid size-7 place-items-center rounded-full bg-lime text-ink"><ArrowUpRight className="size-3.5" /></span>
      </Link>

    </section>
  );
}

function desenharMapa(el: HTMLCanvasElement, pontos: number[]) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width: w, height: h } = el.getBoundingClientRect();
  if (!w || !h) return;
  el.width = Math.round(w * dpr);
  el.height = Math.round(h * dpr);
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  // Projeção equirretangular corrigida pela latitude média; o país ocupa ~86% da área
  const kx = Math.cos((-14 * Math.PI) / 180);
  const larg = (LIMITES.leste - LIMITES.oeste) * kx;
  const alt = LIMITES.norte - LIMITES.sul;
  const escala = Math.min((w * 0.86) / larg, (h * 0.86) / alt);
  const x0 = (w - larg * escala) / 2;
  const y0 = (h - alt * escala) / 2;
  const px = (lng: number) => x0 + (lng - LIMITES.oeste) * kx * escala;
  const py = (lat: number) => y0 + (LIMITES.norte - lat) * escala;

  const n = pontos.length / 3;
  let maxLog = 1;
  for (let i = 0; i < n; i++) maxLog = Math.max(maxLog, Math.log1p(pontos[i * 3 + 2]));
  // Menores primeiro: os polos ficam por cima
  const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => pontos[a * 3 + 2] - pontos[b * 3 + 2]);
  const base = Math.max(0.7, escala / 14); // tamanho acompanha o card

  // Névoa de calor por baixo: onde há muitas cidades o fundo esquenta, como no heatmap do app
  for (const i of ordem) {
    const p = (Math.log1p(pontos[i * 3 + 2]) / maxLog) ** 2;
    if (p < 0.12) continue;
    const x = px(pontos[i * 3 + 1] / 100);
    const y = py(pontos[i * 3] / 100);
    const r = base * (4 + 10 * p);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(143,164,183,0.16)");
    g.addColorStop(1, "rgba(143,164,183,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (const i of ordem) {
    const x = px(pontos[i * 3 + 1] / 100);
    const y = py(pontos[i * 3] / 100);
    const p = (Math.log1p(pontos[i * 3 + 2]) / maxLog) ** 2;
    if (p > 0.55) {
      // Polo: halo lime + miolo escuro, como no mapa de calor do app
      const r = base * (6 + 22 * (p - 0.55));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, p > 0.8 ? "rgba(42,43,46,0.95)" : "rgba(227,252,63,0.95)");
      g.addColorStop(0.35, "rgba(227,252,63,0.75)");
      g.addColorStop(1, "rgba(227,252,63,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(${p > 0.3 ? "120,142,163" : "143,164,183"},${0.25 + p * 0.9})`;
      ctx.beginPath();
      ctx.arc(x, y, base * (0.9 + p * 2.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

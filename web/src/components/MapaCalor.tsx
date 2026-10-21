"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Flame, Minus, Plus, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PontoMapa } from "@/lib/api";
import { escala, numero } from "@/lib/formato";
import { cx } from "./ui";

const ESTILO = "https://tiles.openfreemap.org/styles/positron";

// O worker não sobrevive ao bundle; é servido de /public (copiado no postinstall).
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl(new URL("/maplibre-gl-worker.mjs", window.location.origin).href);
}
type Modo = "calor" | "pontos";

const CORES_CALOR: maplibregl.ExpressionSpecification = [
  "interpolate", ["linear"], ["heatmap-density"],
  0, "rgba(143,164,183,0)",
  0.15, "rgba(143,164,183,0.45)",
  0.4, "rgba(163,181,198,0.85)",
  0.65, "#d9f23a",
  0.85, "#e3fc3f",
  1, "#2a2b2e",
];
const CORES_FOCO: maplibregl.ExpressionSpecification = [
  "interpolate", ["linear"], ["heatmap-density"],
  0, "rgba(143,164,183,0)",
  0.2, "rgba(163,181,198,0.6)",
  0.55, "rgba(217,242,58,0.85)",
  1, "#e3fc3f",
];

export function MapaCalor({ pontos, selecionadas, onCidade, uf }: {
  pontos: PontoMapa[] | null;
  selecionadas: string[];
  onCidade: (codigo: number) => void;
  uf: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MlMap | null>(null);
  const [pronto, setPronto] = useState(false);
  const [modo, setModo] = useState<Modo>("calor");
  const onCidadeRef = useRef(onCidade);
  onCidadeRef.current = onCidade;

  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: ESTILO,
      center: [-51.6, -24.6],
      zoom: 6,
      attributionControl: { compact: true },
      maxBounds: [[-80, -36], [-28, 8]],
      cooperativeGestures: true, // rolar a página não dá zoom sem Ctrl/⌘
    });
    mapa.current = m;

    m.on("load", () => {
      m.addSource("cidades", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      m.addLayer({
        id: "calor",
        type: "heatmap",
        source: "cidades",
        paint: {
          "heatmap-weight": ["get", "peso"],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 9, 2.2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 14, 7, 34, 10, 60],
          "heatmap-opacity": 0.9,
          "heatmap-color": CORES_CALOR,
        },
      });

      m.addLayer({
        id: "pontos",
        type: "circle",
        source: "cidades",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "peso"], 0, 3, 1, 22],
          "circle-color": ["case", ["boolean", ["get", "sel"], false], "#e3fc3f", "#2a2b2e"],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.55, 9, 0.85],
          "circle-stroke-width": ["case", ["boolean", ["get", "sel"], false], 3, 1],
          "circle-stroke-color": ["case", ["boolean", ["get", "sel"], false], "#2a2b2e", "rgba(255,255,255,0.8)"],
        },
      });

      m.addLayer({
        id: "rotulos",
        type: "symbol",
        source: "cidades",
        minzoom: 7,
        filter: [">", ["get", "peso"], 0.35],
        layout: {
          "text-field": ["concat", ["get", "nome"], "\n", ["get", "rotulo"]],
          "text-size": 11,
          "text-offset": [0, 1.6],
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#2a2b2e", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.5 },
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      m.on("mousemove", "pontos", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        m.getCanvas().style.cursor = "pointer";
        const p = f.properties as { nome: string; total: number };
        popup
          .setLngLat(e.lngLat)
          .setHTML(`<strong style="font-weight:600">${p.nome}</strong><br/><span style="color:#8b9099">${numero(p.total)} empresas · clique para filtrar</span>`)
          .addTo(m);
      });
      m.on("mouseleave", "pontos", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", "pontos", (e) => {
        const codigo = e.features?.[0]?.properties?.codigo;
        if (codigo) onCidadeRef.current(Number(codigo));
      });

      setPronto(true);
    });

    return () => {
      m.remove();
      mapa.current = null;
      setPronto(false); // o próximo mapa precisa carregar o estilo de novo
    };
  }, []);

  // Com cidades filtradas o mapa foca nelas: o calor e o enquadramento usam só as selecionadas
  // (as demais continuam clicáveis, invisíveis, para somar cidades ao filtro).
  const foco = pontos?.filter((p) => selecionadas.includes(String(p.codigo))) ?? [];
  const emFoco = foco.length > 0;
  const visiveis = emFoco ? foco : pontos;
  const chaveFoco = foco.map((p) => p.codigo).join(",");

  // Atualiza os dados. Peso em escala log: capital não "apaga" o interior.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto || !pontos || !visiveis) return;
    const maxLog = Math.log1p(Math.max(1, ...visiveis.map((p) => p.total)));
    const fonte = m.getSource("cidades") as GeoJSONSource | undefined;
    if (!fonte) return;
    fonte.setData({
      type: "FeatureCollection",
      features: pontos.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          codigo: p.codigo,
          nome: p.nome,
          total: p.total,
          rotulo: escala(p.total),
          // log ao quadrado: interior aparece, mas os polos se destacam
          // em foco são poucas cidades: todas precisam acender, a maior só um pouco mais
          peso: emFoco ? 0.6 + 0.4 * (Math.log1p(p.total) / maxLog) : (Math.log1p(p.total) / maxLog) ** 2,
          sel: selecionadas.includes(String(p.codigo)),
        },
      })),
    });
    const soSelecionadas = emFoco ? ["==", ["get", "sel"], true] : null;
    m.setFilter("calor", soSelecionadas as maplibregl.FilterSpecification | null);
    m.setFilter("rotulos", (emFoco ? soSelecionadas : [">", ["get", "peso"], 0.35]) as maplibregl.FilterSpecification);
    m.setLayerZoomRange("rotulos", emFoco ? 0 : 7, 24);
    // Em foco o miolo fica lime (sem o tom escuro de "polo"), para o nome da cidade continuar legível
    m.setPaintProperty("calor", "heatmap-color", emFoco ? CORES_FOCO : CORES_CALOR);
    m.setPaintProperty("calor", "heatmap-intensity", emFoco ? 3 : ["interpolate", ["linear"], ["zoom"], 4, 0.8, 9, 2.2]);
    m.setPaintProperty("calor", "heatmap-radius", emFoco
      ? ["interpolate", ["linear"], ["zoom"], 4, 30, 7, 55, 10, 90]
      : ["interpolate", ["linear"], ["zoom"], 4, 14, 7, 34, 10, 60]);
  }, [pontos, pronto, selecionadas, emFoco, visiveis]);

  // Enquadra o mapa ao trocar de UF ou de cidades filtradas
  useEffect(() => {
    if (!mapa.current || !pronto || !visiveis?.length) return;
    enquadrar(mapa.current, visiveis);
  }, [uf, pronto, pontos?.length, chaveFoco]);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto || !m.getLayer("calor")) return;
    m.setLayoutProperty("calor", "visibility", modo === "calor" ? "visible" : "none");
    // No modo calor os círculos ficam invisíveis, mas continuam respondendo a hover/clique
    // Em foco, só as cidades filtradas aparecem como ponto (as outras seguem clicáveis)
    const visivel: maplibregl.ExpressionSpecification | number = emFoco ? ["case", ["boolean", ["get", "sel"], false], 1, 0] : 1;
    m.setPaintProperty("pontos", "circle-opacity", modo === "calor" ? 0 : ["*", 0.8, visivel]);
    m.setPaintProperty("pontos", "circle-stroke-opacity", modo === "calor" ? 0 : visivel);
  }, [modo, pronto, emFoco]);

  const topCidade = visiveis?.reduce<PontoMapa | null>((a, b) => (!a || b.total > a.total ? b : a), null);

  return (
    <section className="glass relative h-full min-h-[440px] overflow-hidden rounded-[var(--radius-card)] p-2">
      <div className="absolute inset-2 overflow-hidden rounded-[22px]">
        <div ref={container} className="size-full" />
      </div>

      <div className="pointer-events-none absolute inset-x-5 top-5 flex items-start justify-between gap-3">
        <div className="glass pointer-events-auto rounded-3xl px-4 py-3">
          <p className="text-xs text-muted">Mapa de calor · {uf}</p>
          <p className="text-lg leading-tight">
            {!visiveis ? "Carregando…" : emFoco
              ? (foco.length === 1 ? foco[0].nome : `${foco.length} cidades filtradas`)
              : `${numero(visiveis.length)} cidades`}
          </p>
          {emFoco && foco.length === 1 && <p className="text-xs text-ink/60">{numero(foco[0].total)} empresas</p>}
          {topCidade && !(emFoco && foco.length === 1) && <p className="text-xs text-ink/60">maior polo: {topCidade.nome}</p>}
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink p-1">
          {(["calor", "pontos"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={cx(
                "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs capitalize transition",
                modo === m ? "bg-lime text-ink" : "text-white/70 hover:text-white",
              )}
            >
              {m === "calor" ? <Flame className="size-3.5" /> : <Target className="size-3.5" />}
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 left-5 glass rounded-2xl px-3 py-2">
        <div className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg, rgba(143,164,183,.5), #a3b5c6, #e3fc3f, #2a2b2e)" }} />
        <div className="mt-1 flex justify-between text-[10px] text-muted"><span>menos</span><span>mais empresas</span></div>
      </div>

      <div className="absolute bottom-12 right-5 flex flex-col gap-1.5">
        {[
          { i: <Plus className="size-4" />, t: "Aproximar", f: () => mapa.current?.zoomIn() },
          { i: <Minus className="size-4" />, t: "Afastar", f: () => mapa.current?.zoomOut() },
          { i: <Crosshair className="size-4" />, t: "Enquadrar", f: () => mapa.current && visiveis && enquadrar(mapa.current, visiveis) },
        ].map((b) => (
          <button key={b.t} type="button" title={b.t} aria-label={b.t} onClick={b.f}
            className="glass grid size-10 place-items-center rounded-full hover:bg-white">
            {b.i}
          </button>
        ))}
      </div>
    </section>
  );
}

function enquadrar(m: MlMap, pontos: PontoMapa[]) {
  if (!pontos.length) return;
  const b = new maplibregl.LngLatBounds();
  pontos.forEach((p) => b.extend([p.lng, p.lat]));
  m.fitBounds(b, { padding: { top: 110, bottom: 60, left: 50, right: 70 }, maxZoom: pontos.length === 1 ? 9 : 10, duration: 800 });
}

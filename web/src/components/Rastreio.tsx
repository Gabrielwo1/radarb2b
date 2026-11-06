"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Conta visualizações de página para o painel /admin (sem cookies de terceiros, sem IP).
// Visitante = id aleatório no navegador; a origem e a campanha (utm) da primeira página ficam na sessão.
export function Rastreio() {
  const caminho = usePathname();
  useEffect(() => {
    if (!caminho || caminho.startsWith("/admin") || navigator.webdriver) return;
    try {
      let visitante = localStorage.getItem("radar:visitante");
      if (!visitante) {
        visitante = crypto.randomUUID();
        localStorage.setItem("radar:visitante", visitante);
      }
      const sp = new URLSearchParams(location.search);
      if (sp.get("utm_source")) sessionStorage.setItem("radar:utm", JSON.stringify({ s: sp.get("utm_source"), c: sp.get("utm_campaign") }));
      const utm = JSON.parse(sessionStorage.getItem("radar:utm") ?? "{}") as { s?: string; c?: string };
      let origem = "";
      try {
        const r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
        if (r && r !== location.hostname.replace(/^www\./, "")) origem = r;
      } catch {}
      const corpo = JSON.stringify({
        visitante, caminho, origem, utm_source: utm.s ?? "", utm_campaign: utm.c ?? "",
        dispositivo: matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      });
      if (!navigator.sendBeacon?.("/api/visita", new Blob([corpo], { type: "application/json" }))) {
        fetch("/api/visita", { method: "POST", body: corpo, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
      }
    } catch {}
  }, [caminho]);
  return null;
}

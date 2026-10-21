"use client";

import { useSyncExternalStore } from "react";

// Última pesquisa feita na Prospecção (texto do chat + filtros). Fica no navegador para que,
// ao ir ao CRM ou a outra página e voltar, a busca seja reaplicada e possa ser limpa ou refeita.

/** `query` é a pesquisa feita (chat ou busca salva); `atual` são os filtros na tela, ajustados depois dela. */
export type UltimaBusca = { texto: string | null; query: string; atual: string };

const CHAVE = "radar:ultima-busca";
const ouvintes = new Set<() => void>();
let cache: UltimaBusca | null | undefined;

function ler(): UltimaBusca | null {
  if (cache !== undefined) return cache;
  try {
    const v = localStorage.getItem(CHAVE);
    cache = v ? (JSON.parse(v) as UltimaBusca) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function gravar(valor: UltimaBusca | null) {
  cache = valor;
  try {
    if (valor) localStorage.setItem(CHAVE, JSON.stringify(valor));
    else localStorage.removeItem(CHAVE);
  } catch {}
  ouvintes.forEach((f) => f());
}

export const ultimaBusca = ler;

/** Nova pesquisa (chat ou busca salva). */
export function registrarBusca(query: string, texto: string | null) {
  gravar(query ? { texto, query, atual: query } : null);
}

/** Ajuste de filtros: mantém a pesquisa original para poder refazê-la. */
export function registrarFiltros(atual: string) {
  const salva = ler();
  if (salva?.texto) gravar({ ...salva, atual });
  else gravar(atual ? { texto: null, query: atual, atual } : null); // sem chat, a pesquisa são os próprios filtros
}

export function limparBusca() {
  gravar(null);
}

export function useUltimaBusca() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    ler,
    () => null,
  );
}

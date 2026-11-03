"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Motivo, Situacao } from "./planos";
import { useSessao } from "./sessao";

// Plano + créditos do usuário (componente do topo) e a janela "sem crédito", aberta quando a API responde 402.

type Estado = { conta: Situacao | null; bloqueio: { motivo: Motivo; chave?: string | null } | null };
let estado: Estado = { conta: null, bloqueio: null };
const ouvintes = new Set<() => void>();
const mudar = (p: Partial<Estado>) => {
  estado = { ...estado, ...p };
  ouvintes.forEach((f) => f());
};
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};
const INICIAL: Estado = { conta: null, bloqueio: null };

let pedido: Promise<void> | null = null;
/** Busca de novo o plano e o consumo (depois de cada pesquisa, contato aberto ou pagamento). */
export function atualizarConta() {
  pedido ??= fetch("/api/conta", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => mudar({ conta: c }))
    .catch(() => {})
    .finally(() => { pedido = null; });
  return pedido;
}

export function useConta() {
  const { usuario, versao } = useSessao();
  const s = useSyncExternalStore(assinar, () => estado, () => INICIAL);
  useEffect(() => {
    if (usuario) atualizarConta();
    else mudar({ conta: null });
  }, [usuario, versao]);
  const conta = s.conta;
  return {
    conta,
    temPlano: conta?.plano === "pro" || conta?.plano === "empresa",
    avulsa: (chave: string) => !!conta?.avulsas.some((a) => a.chave === chave),
  };
}

export function abrirPlanos(motivo: Motivo, chave?: string | null) {
  mudar({ bloqueio: { motivo, chave } });
}
export function fecharPlanos() {
  mudar({ bloqueio: null });
}
export function useBloqueio() {
  return useSyncExternalStore(assinar, () => estado, () => INICIAL).bloqueio;
}

/** Trata uma resposta 402 da API: abre a janela de planos com o motivo. Devolve true se era 402. */
export async function tratar402(r: Response) {
  if (r.status !== 402) return false;
  const corpo = (await r.clone().json().catch(() => null)) as { motivo?: Motivo; chave?: string } | null;
  abrirPlanos(corpo?.motivo ?? "pesquisas", corpo?.chave);
  atualizarConta();
  return true;
}

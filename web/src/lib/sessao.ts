"use client";

import { useSyncExternalStore } from "react";
import { supabaseNavegador } from "./supabase/client";

// Sessão do usuário + pop-up de acesso. O app é aberto para visitantes; a primeira ação real
// (enviar no chat, mexer em filtro, abrir empresa, CRM...) passa por exigirLogin(), que abre o
// pop-up e executa a ação assim que a pessoa entra ou cria a conta.

export type Usuario = { id: string; email: string; nome: string };
type Estado = {
  usuario: Usuario | null;
  carregado: boolean;
  /** Muda a cada login/logout: hooks de dados usam para buscar de novo com a nova permissão */
  versao: number;
  modal: { aberto: boolean; motivo: string | null; modo: "entrar" | "criar" };
};

const INICIAL: Estado = { usuario: null, carregado: false, versao: 0, modal: { aberto: false, motivo: null, modo: "criar" } };
let estado: Estado = INICIAL;
let pendente: (() => void) | null = null;
let iniciado = false;
const ouvintes = new Set<() => void>();
const mudar = (parcial: Partial<Estado>) => {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((f) => f());
};

const paraUsuario = (u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined): Usuario | null =>
  u ? { id: u.id, email: u.email ?? "", nome: (u.user_metadata?.nome as string) || (u.email ?? "").split("@")[0] } : null;

function iniciar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  const supabase = supabaseNavegador();
  supabase.auth.getSession().then(({ data }) => mudar({ usuario: paraUsuario(data.session?.user), carregado: true }));
  supabase.auth.onAuthStateChange((evento, sessao) => {
    const usuario = paraUsuario(sessao?.user);
    const trocou = (usuario?.id ?? null) !== (estado.usuario?.id ?? null);
    mudar({ usuario, carregado: true, versao: trocou && evento !== "INITIAL_SESSION" ? estado.versao + 1 : estado.versao });
    if (evento === "SIGNED_IN" && usuario) {
      if (estado.modal.aberto) mudar({ modal: { ...estado.modal, aberto: false, motivo: null } });
      if (pendente) {
        const acao = pendente;
        pendente = null;
        setTimeout(acao, 0);
      }
    }
  });
}

export function useSessao() {
  iniciar();
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado,
    // Servidor e hidratação sempre começam em "carregando" (evita divergência de HTML)
    () => INICIAL,
  );
}

/** Executa a ação se houver sessão; senão abre o pop-up e guarda a ação para depois do login. */
export function exigirLogin(acao: () => void, motivo?: string) {
  iniciar();
  if (estado.usuario) return acao();
  pendente = acao;
  mudar({ modal: { aberto: true, motivo: motivo ?? null, modo: "criar" } });
}

export function abrirAcesso(modo: "entrar" | "criar" = "entrar", motivo?: string) {
  mudar({ modal: { aberto: true, motivo: motivo ?? null, modo } });
}

export function fecharAcesso() {
  pendente = null;
  mudar({ modal: { ...estado.modal, aberto: false } });
}

export async function sair() {
  await supabaseNavegador().auth.signOut();
}

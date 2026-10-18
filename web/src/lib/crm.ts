"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSessao } from "./sessao";
import { supabaseNavegador } from "./supabase/client";

export type EtapaId = "novo" | "contato" | "qualificado" | "proposta" | "negociacao" | "ganho" | "perdido";

export const ETAPAS: { id: EtapaId; rotulo: string; cor: string; fundo: string }[] = [
  { id: "novo", rotulo: "Novos", cor: "#a3b5c6", fundo: "rgb(163 181 198 / 0.16)" },
  { id: "contato", rotulo: "Em contato", cor: "#b9a7f5", fundo: "rgb(185 167 245 / 0.16)" },
  { id: "qualificado", rotulo: "Qualificados", cor: "#7fd8b1", fundo: "rgb(127 216 177 / 0.16)" },
  { id: "proposta", rotulo: "Proposta", cor: "#f5cf5b", fundo: "rgb(245 207 91 / 0.16)" },
  { id: "negociacao", rotulo: "Negociação", cor: "#f2a97e", fundo: "rgb(242 169 126 / 0.16)" },
  { id: "ganho", rotulo: "Ganhos", cor: "#e3fc3f", fundo: "rgb(227 252 63 / 0.22)" },
  { id: "perdido", rotulo: "Perdidos", cor: "#8b9099", fundo: "rgb(139 144 153 / 0.12)" },
];
export const etapa = (id: EtapaId) => ETAPAS.find((e) => e.id === id)!;

export type Lead = {
  cnpj: string;
  etapa: EtapaId;
  ordem: number;
  valor: string | null;
  proxima_acao: string | null;
  notas: string | null;
  origem: string | null;
  criado_em: string;
  atualizado_em: string;
  dados: {
    razao_social: string | null;
    nome_fantasia: string | null;
    municipio: string | null;
    uf: string;
    bairro: string | null;
    telefone1: string | null;
    telefone2: string | null;
    email: string | null;
    cnae_principal: number | null;
    cnae_descricao: string | null;
    porte: number | null;
    capital_social: string | null;
    simples: boolean | null;
    mei: boolean | null;
    data_abertura: string | null;
    endereco: string | null;
    cep: string | null;
  };
};

// Store único (prospecção e kanban enxergam o mesmo estado)
let leads: Lead[] = [];
let carregado = false;
let carregando: Promise<void> | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const definir = (novo: Lead[]) => {
  leads = novo;
  avisar();
};

// Leads ficam no Supabase (tabela crm_leads, protegida por RLS: cada usuário vê só os seus)
const COLUNAS = "cnpj, etapa, ordem, valor, proxima_acao, notas, origem, dados, criado_em, atualizado_em";
const normalizar = (l: Record<string, unknown>) => ({ ...l, valor: l.valor == null ? null : String(l.valor) }) as Lead;

export function recarregarCrm() {
  carregando = (async () => {
    const { data, error } = await supabaseNavegador().from("crm_leads").select(COLUNAS)
      .order("etapa").order("ordem").order("criado_em").limit(5000);
    if (error) throw new Error(error.message);
    carregado = true;
    definir((data ?? []).map(normalizar));
  })().finally(() => {
    carregando = null;
  });
  return carregando;
}

/** Adiciona ao funil (o servidor busca os dados da empresa na base e grava na conta do usuário). */
export async function adicionarAoCrm(cnpjs: string[], opcoes: { etapa?: EtapaId; origem?: string } = {}) {
  const r = await fetch("/api/crm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cnpjs, etapa: opcoes.etapa, origem: opcoes.origem }),
  });
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(corpo?.erro ?? `Erro ${r.status}`);
  await recarregarCrm();
  return corpo.adicionados as number;
}

export async function atualizarLead(cnpj: string, mudancas: Partial<Pick<Lead, "etapa" | "ordem" | "valor" | "proxima_acao" | "notas">>) {
  const antes = leads;
  definir(leads.map((l) => (l.cnpj === cnpj ? { ...l, ...mudancas, atualizado_em: new Date().toISOString() } : l)));
  const { error } = await supabaseNavegador().from("crm_leads").update(mudancas).eq("cnpj", cnpj);
  if (error) {
    definir(antes);
    throw new Error(error.message);
  }
}

export async function removerLead(cnpj: string) {
  const antes = leads;
  definir(leads.filter((l) => l.cnpj !== cnpj));
  const { error } = await supabaseNavegador().from("crm_leads").delete().eq("cnpj", cnpj);
  if (error) {
    definir(antes);
    throw new Error(error.message);
  }
}

export function useCrm() {
  const lista = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => leads,
    () => leads,
  );
  // Recarrega ao entrar/sair da conta (cada usuário tem o seu funil)
  const { versao } = useSessao();
  useEffect(() => {
    if (versao > 0 || (!carregado && !carregando)) recarregarCrm().catch(() => {});
  }, [versao]);
  return { leads: lista, carregado };
}

/** Mapa cnpj → etapa, para marcar na lista de prospecção quem já está no funil. */
export function useEtapasCrm() {
  const { leads } = useCrm();
  return new Map(leads.map((l) => [l.cnpj, l.etapa]));
}

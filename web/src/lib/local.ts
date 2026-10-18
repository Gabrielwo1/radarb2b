"use client";

import { useCallback, useEffect, useState } from "react";
import { useSessao } from "./sessao";
import { supabaseNavegador } from "./supabase/client";

// Persistência local (MVP). Depois migra para o Supabase com login.

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
}

export function useLocal<T>(chave: string, padrao: T) {
  const [valor, setValor] = useState<T>(padrao);
  useEffect(() => setValor(ler(chave, padrao)), [chave]);
  const atualizar = useCallback(
    (fn: (atual: T) => T) =>
      setValor((atual) => {
        const novo = fn(atual);
        gravar(chave, novo);
        return novo;
      }),
    [chave],
  );
  return [valor, atualizar] as const;
}

// Favoritos e buscas salvas ficam na conta do usuário (Supabase, com RLS).

export type Salvo = { cnpj: string; nome: string; municipio: string | null; salvoEm: string };
export type BuscaSalva = { id: string; nome: string; query: string; criadaEm: string };

/** Store simples compartilhado entre componentes, carregado uma vez por sessão. */
function criarStore<T>(carregar: () => Promise<T[]>) {
  let itens: T[] = [];
  let pedido: Promise<void> | null = null;
  const ouvintes = new Set<() => void>();
  const definir = (novo: T[]) => {
    itens = novo;
    ouvintes.forEach((f) => f());
  };
  const recarregar = () => (pedido ??= carregar().then(definir).catch(() => {}).finally(() => { pedido = null; }));
  function useStore() {
    const [lista, setLista] = useState(itens);
    const { versao } = useSessao();
    useEffect(() => {
      const f = () => setLista(itens);
      ouvintes.add(f);
      recarregar(); // também ao entrar/sair da conta
      return () => {
        ouvintes.delete(f);
      };
    }, [versao]);
    return lista;
  }
  return { useStore, get: () => itens, definir, recarregar };
}

const favoritos = criarStore<Salvo>(async () => {
  const { data } = await supabaseNavegador().from("favoritos").select("cnpj, nome, municipio, salvo_em").order("salvo_em", { ascending: false });
  return (data ?? []).map((f: { cnpj: string; nome: string; municipio: string | null; salvo_em: string }) => ({ cnpj: f.cnpj, nome: f.nome, municipio: f.municipio, salvoEm: f.salvo_em }));
});

export function useSalvos() {
  const salvos = favoritos.useStore();
  const alternar = async (s: Omit<Salvo, "salvoEm">) => {
    const antes = favoritos.get();
    const db = supabaseNavegador().from("favoritos");
    if (antes.some((x) => x.cnpj === s.cnpj)) {
      favoritos.definir(antes.filter((x) => x.cnpj !== s.cnpj));
      const { error } = await db.delete().eq("cnpj", s.cnpj);
      if (error) favoritos.definir(antes);
    } else {
      favoritos.definir([{ ...s, salvoEm: new Date().toISOString() }, ...antes]);
      const { error } = await db.insert({ cnpj: s.cnpj, nome: s.nome, municipio: s.municipio });
      if (error) favoritos.definir(antes);
    }
  };
  const ehSalvo = (cnpj: string) => salvos.some((x) => x.cnpj === cnpj);
  return { salvos, alternar, ehSalvo };
}

const buscas = criarStore<BuscaSalva>(async () => {
  const { data } = await supabaseNavegador().from("buscas_salvas").select("id, nome, query, criada_em").order("criada_em", { ascending: false });
  return (data ?? []).map((b: { id: string; nome: string; query: string; criada_em: string }) => ({ id: b.id, nome: b.nome, query: b.query, criadaEm: b.criada_em }));
});

export function useBuscasSalvas() {
  const lista = buscas.useStore();
  const salvar = async (nome: string, query: string) => {
    const { error } = await supabaseNavegador().from("buscas_salvas").insert({ nome, query });
    if (!error) buscas.recarregar();
  };
  const remover = async (id: string) => {
    const antes = buscas.get();
    buscas.definir(antes.filter((b) => b.id !== id));
    const { error } = await supabaseNavegador().from("buscas_salvas").delete().eq("id", id);
    if (error) buscas.definir(antes);
  };
  return { buscas: lista, salvar, remover };
}

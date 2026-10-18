"use client";

import { useEffect, useRef, useState } from "react";

export type Empresa = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: number;
  situacao_descricao: string | null;
  data_abertura: string | null;
  cnae_principal: number | null;
  cnae_descricao: string | null;
  porte: number | null;
  porte_descricao: string | null;
  capital_social: string | null;
  simples: boolean | null;
  mei: boolean | null;
  matriz: boolean;
  bairro: string | null;
  municipio: string | null;
  uf: string;
  telefone1: string | null;
  telefone2: string | null;
  email: string | null;
  tipo_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  cep: string | null;
};

export type EmpresaDetalhe = Empresa & {
  natureza_juridica: number | null;
  mes_referencia: string;
  cnaes_secundarios_detalhe: { codigo: number; descricao: string }[];
};

export type Busca = { total: number; pagina: number; limite: number; resultados: Empresa[] };

export type Resumo = {
  total: number;
  com_telefone: number;
  com_email: number;
  novas_12m: number;
  simples: number;
  mei: number;
  top_cnaes: { codigo: number; descricao: string | null; total: number }[];
  top_municipios: { codigo: number; nome: string; total: number }[];
  aberturas_por_ano: { ano: number; total: number }[];
};

export type PontoMapa = { codigo: number; nome: string; lat: number; lng: number; total: number };
export type Municipio = { codigo: number; nome: string; uf: string; total: number };
export type Cnae = { codigo: number; descricao: string };
export type Stats = { ultima_carga: { mes_referencia: string; ufs: string; total_estabelecimentos: number } | null };

export const urlApi = (rota: string, q?: URLSearchParams) =>
  `/api/b2b/${rota}${q && q.size ? `?${q}` : ""}`;

/** Busca com cancelamento e mantendo o dado anterior enquanto carrega (sem "piscar"). */
export function useApi<T>(url: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    if (!url) return;
    ultimo.current = url;
    const ctrl = new AbortController();
    setCarregando(true);
    setErro(null);
    fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.erro ?? `Erro ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((d) => {
        if (ultimo.current === url) setDados(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setErro(e.message);
      })
      .finally(() => {
        if (ultimo.current === url) setCarregando(false);
      });
    return () => ctrl.abort();
  }, [url]);

  return { dados, carregando, erro };
}

export function useDebounce<T>(valor: T, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

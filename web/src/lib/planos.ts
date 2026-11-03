// Planos, preços e limites (compartilhado entre servidor e navegador).

export const LIMITES_GRATIS = { pesquisas: 5, contatos: 10, paginas: 2 };
export const PAGINAS_AVULSO = 20;
export const POR_PAGINA = 30;

export type TipoCompra = "avulso" | "pro_mensal" | "pro_anual";

export const PRECOS: Record<TipoCompra, { valor: number; titulo: string; parcelas: number }> = {
  avulso: { valor: 10, titulo: "Consulta avulsa Radar B2B", parcelas: 1 },
  pro_mensal: { valor: 99, titulo: "Radar B2B Pro · mensal", parcelas: 1 },
  pro_anual: { valor: 712.8, titulo: "Radar B2B Pro · anual", parcelas: 12 },
};

export const ANUAL_SEM_DESCONTO = 99 * 12; // R$ 1.188

export type Situacao = {
  plano: "gratis" | "pro" | "empresa";
  ciclo: "mensal" | "anual" | "manual" | null;
  valido_ate: string | null;
  recorrente: boolean;
  pesquisas: number;
  contatos: number;
  avulsas: { chave: string; valido_ate: string }[];
};

export type Motivo = "pesquisas" | "contatos" | "paginas" | "paginas_avulso" | "crm" | "exportar" | "whatsapp";

/** Identifica uma pesquisa pelos filtros (sem página, ordenação ou tamanho): é o que conta como "1 pesquisa". */
export function chaveBusca(q: URLSearchParams) {
  const c = new URLSearchParams();
  for (const [k, v] of q) if (!["page", "limit", "ordem"].includes(k) && v) c.append(k, v);
  c.sort();
  return c.toString();
}

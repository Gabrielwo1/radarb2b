// Estado dos filtros vive na URL: buscas ficam compartilháveis e o "voltar" do navegador funciona.

export type Aba = "todas" | "telefone" | "novas" | "salvos";

export const FILTROS_API = [
  "uf", "municipio", "cnae", "cnae_secundario", "porte", "abertura_de", "abertura_ate",
  "com_telefone", "com_email", "simples", "mei", "matriz", "q", "bairro", "capital_min",
] as const;

export const UF_PADRAO = "PR";

export const PORTES = [
  { valor: "1", rotulo: "Microempresa", curto: "ME" },
  { valor: "3", rotulo: "Pequeno porte", curto: "EPP" },
  { valor: "5", rotulo: "Médio e grande", curto: "Demais" },
];

export const TOGGLES = [
  { chave: "com_telefone", rotulo: "Com telefone" },
  { chave: "com_email", rotulo: "Com e-mail" },
  { chave: "simples", rotulo: "Optante do Simples" },
  { chave: "mei", rotulo: "MEI" },
  { chave: "matriz", rotulo: "Somente matriz" },
] as const;

export function lista(v: string | null | undefined) {
  return v ? v.split(",").filter(Boolean) : [];
}

/** Monta a query enviada à API a partir da URL, aplicando a aba ativa. */
export function queryApi(sp: URLSearchParams, extra: Record<string, string> = {}) {
  const q = new URLSearchParams();
  for (const k of FILTROS_API) {
    const v = sp.get(k);
    if (v) q.set(k, v);
  }
  if (!q.has("uf")) q.set("uf", UF_PADRAO);
  if (q.get("uf") === "BR") q.delete("uf"); // Brasil inteiro

  const aba = (sp.get("aba") as Aba) ?? "todas";
  if (aba === "telefone") q.set("com_telefone", "true");
  if (aba === "novas" && !q.has("abertura_de")) q.set("abertura_de", dataRelativa(12));

  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q;
}

/** Quantidade de filtros ativos (sem contar a UF padrão). */
export function contarFiltros(sp: URLSearchParams) {
  let n = 0;
  for (const k of FILTROS_API) {
    if (k === "uf" && (sp.get(k) ?? UF_PADRAO) === UF_PADRAO) continue;
    if (k === "cnae_secundario") continue;
    if (sp.get(k)) n++;
  }
  return n;
}

export function dataRelativa(meses: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d.toISOString().slice(0, 10);
}

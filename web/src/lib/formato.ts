const num = new Intl.NumberFormat("pt-BR");
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const numero = (v?: number | null) => (v == null ? "—" : num.format(v));
export const numeroCompacto = (v?: number | null) => (v == null ? "—" : compacto.format(v));

const umaCasa = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const duasCasas = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Volume em escala: até 99.999 exato; 100 mil+ em k (389,3k); 1 milhão+ em M (1,64M). */
export function escala(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${duasCasas.format(v / 1_000_000)}M`;
  if (v >= 100_000) return `${umaCasa.format(v / 1_000)}k`;
  return num.format(v);
}

export function moeda(v?: string | number | null) {
  if (v == null) return "—";
  const n = Number(v);
  if (n >= 100_000) return `R$ ${escala(n)}`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export const porcentagem = (parte?: number, total?: number) =>
  !total ? "0%" : `${Math.round(((parte ?? 0) / total) * 100)}%`;

export function cnpj(v: string) {
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Normaliza o telefone da Receita (DDD + 8 dígitos, sem o 9 dos celulares).
 * Número de 8 dígitos começando com 6–9 é celular: ganha o 9 na frente. Inválido → null.
 */
export function digitosTelefone(v?: string | null) {
  if (!v) return null;
  let d = v.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 && /[6-9]/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  if (!/^[1-9][1-9](9\d{8}|[2-5]\d{7})$/.test(d)) return null;
  return d;
}

export function telefone(v?: string | null) {
  const d = digitosTelefone(v);
  if (!d) return null;
  return d.length === 11 ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
}

/** Celular → dá para abrir no WhatsApp. */
export const ehCelular = (v?: string | null) => digitosTelefone(v)?.length === 11;
export const linkWhatsApp = (v: string) => `https://wa.me/55${digitosTelefone(v)}`;

export function data(v?: string | null) {
  if (!v) return "—";
  const [a, m, d] = v.split("-");
  return `${d}/${m}/${a}`;
}

export function idade(v?: string | null) {
  if (!v) return null;
  const anos = (Date.now() - new Date(v).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (anos < 1) return `${Math.max(1, Math.round(anos * 12))} meses`;
  return `${Math.floor(anos)} ${Math.floor(anos) === 1 ? "ano" : "anos"}`;
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o"]);
const SIGLAS = new Set(["ltda", "me", "epp", "s/a", "sa", "eireli", "mei", "ss"]);

/** "PADARIA PAO QUENTE LTDA" → "Padaria Pao Quente LTDA" */
export function nomeProprio(v?: string | null) {
  if (!v) return "";
  return v
    .replace(/^\d{2}\.\d{3}\.\d{3}\s+/, "") // MEI: razão social começa com o CNPJ básico
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => {
      const limpo = p.replace(/[.,]/g, "");
      if (SIGLAS.has(limpo)) return p.toUpperCase();
      if (i > 0 && MINUSCULAS.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

export function iniciais(v?: string | null) {
  const partes = (v ?? "").replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter((p) => p.length > 2);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "··";
}

const TONS = ["#e3fc3f", "#a3b5c6", "#f2c7a5", "#c4b5fd", "#9ee6c4", "#f5a8b8", "#ffe08a"];
export function tom(v: string) {
  let h = 0;
  for (const c of v) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONS[h % TONS.length];
}

export const cep = (v?: string | null) => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 5)}-${v.slice(5)}` : v ?? "");

export function enderecoCurto(e: { tipo_logradouro: string | null; logradouro: string | null; numero: string | null }) {
  return nomeProprio([e.tipo_logradouro, e.logradouro].filter(Boolean).join(" ")) + (e.numero ? `, ${e.numero}` : "");
}

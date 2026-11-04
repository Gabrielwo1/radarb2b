// Meta Pixel do Radar B2B (conjunto de dados "Radar B2B | b2bradar.pro"). NEXT_PUBLIC_META_PIXEL_ID sobrescreve o padrão.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1829678221491772";

type Fbq = (acao: "track" | "trackCustom", evento: string, dados?: Record<string, unknown>) => void;

/** Dispara um evento padrão do pixel. Não faz nada se o script ainda não carregou ou foi bloqueado. */
export function rastrear(evento: string, dados?: Record<string, unknown>) {
  const fbq = (globalThis as { fbq?: Fbq }).fbq;
  if (typeof fbq === "function") fbq("track", evento, dados);
}

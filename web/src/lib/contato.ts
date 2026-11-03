// Contato da equipe Radar B2B (WhatsApp). NEXT_PUBLIC_WHATSAPP_EQUIPE sobrescreve o número padrão.
export const WHATSAPP_EQUIPE = (process.env.NEXT_PUBLIC_WHATSAPP_EQUIPE || "5546999247368").replace(/\D/g, "");

export const linkEquipe = (texto: string) => `https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(texto)}`;

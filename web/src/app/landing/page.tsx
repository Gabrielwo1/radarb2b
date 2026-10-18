import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "Radar B2B — Encontre as empresas que compram de você",
  description: "28 milhões de empresas ativas da Receita Federal com filtros por cidade, segmento e porte, WhatsApp em um clique e CRM integrado.",
};

export default function Page() {
  return <Landing />;
}

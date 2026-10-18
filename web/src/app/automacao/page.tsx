import type { Metadata } from "next";
import { Automacao } from "@/components/automacao/Automacao";

export const metadata: Metadata = { title: "Radar B2B — Automação com IA" };

export default function Page() {
  return <Automacao />;
}

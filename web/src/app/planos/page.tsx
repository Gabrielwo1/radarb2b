import type { Metadata } from "next";
import { Suspense } from "react";
import { PaginaPlanos } from "@/components/planos/PaginaPlanos";

export const metadata: Metadata = {
  title: "Planos — Radar B2B",
  description: "Comece grátis, libere uma pesquisa por R$ 10 ou assine o Pro com pesquisas, contatos e CRM ilimitados.",
};

export default function Page() {
  return (
    <Suspense>
      <PaginaPlanos />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Painel } from "@/components/admin/Painel";
import { adminAtual } from "@/lib/admin";

export const metadata: Metadata = { title: "Gestão — Radar B2B", robots: { index: false, follow: false } };

// Só quem está em ADMIN_EMAILS vê o painel; para os demais a página "não existe".
async function Guarda() {
  if (!(await adminAtual())) notFound();
  return <Painel />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 size-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />}>
      <Guarda />
    </Suspense>
  );
}

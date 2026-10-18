import type { Metadata } from "next";
import { Suspense } from "react";
import { Entrar } from "@/components/auth/Entrar";

export const metadata: Metadata = { title: "Radar B2B — Entrar" };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Entrar />
    </Suspense>
  );
}

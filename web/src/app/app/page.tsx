import type { Metadata } from "next";
import { Suspense } from "react";
import { Prospeccao } from "@/components/Prospeccao";

export const metadata: Metadata = { title: "Radar B2B — Prospecção" };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Prospeccao />
    </Suspense>
  );
}

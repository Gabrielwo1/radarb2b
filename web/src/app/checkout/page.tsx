import type { Metadata } from "next";
import { Suspense } from "react";
import { Checkout } from "@/components/planos/Checkout";

export const metadata: Metadata = { title: "Pagamento — Radar B2B", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}

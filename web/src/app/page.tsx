import { Suspense } from "react";
import { Prospeccao } from "@/components/Prospeccao";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Prospeccao />
    </Suspense>
  );
}

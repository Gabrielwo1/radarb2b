import { respostaAdmin } from "@/lib/admin";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return respostaAdmin("admin_contas", {
    p_busca: (q.get("busca") ?? "").slice(0, 100),
    p_plano: q.get("plano") ?? "",
    p_pagina: Math.max(1, Number(q.get("pagina")) || 1),
  });
}

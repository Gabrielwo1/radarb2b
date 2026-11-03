"use client";

import { useState } from "react";
import { atualizarConta, useConta } from "@/lib/conta";
import { TopNav } from "../TopNav";
import { Toasts, avisar } from "../ui";
import { TabelaPlanos } from "./Planos";

const PERGUNTAS = [
  { p: "Posso pagar com Pix?", r: "Sim. A consulta avulsa e o anual podem ser pagos no Pix à vista. No mensal, o Pix libera 30 dias e você renova quando quiser; no cartão a renovação é automática." },
  { p: "Como funciona a consulta avulsa de R$ 10?", r: "Você faz a pesquisa no app (cidade, segmento, filtros) e libera só ela: até 20 páginas de empresas com telefone, WhatsApp e e-mail, mais a exportação em CSV, por 30 dias." },
  { p: "Posso cancelar quando quiser?", r: "Sim. Cancelando, a renovação automática para e você continua com o Pro até o fim do período já pago." },
  { p: "O anual pode ser parcelado?", r: "Sim, em até 12x no cartão. À vista no Pix sai pelo mesmo valor com 40% de desconto sobre o mensal." },
];

export function PaginaPlanos() {
  const { conta } = useConta();
  const [cancelando, setCancelando] = useState(false);

  const cancelar = async () => {
    if (!confirm("Cancelar a renovação automática? Você continua com o Pro até o fim do período pago.")) return;
    setCancelando(true);
    const r = await fetch("/api/assinatura", { method: "DELETE" });
    setCancelando(false);
    if (r.ok) {
      avisar("Renovação cancelada. Seu acesso continua até o fim do período.");
      atualizarConta();
    } else avisar((await r.json().catch(() => null))?.erro ?? "Não foi possível cancelar agora");
  };

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-5 sm:px-6 lg:px-8">
      <TopNav pagina="planos" />
      <Toasts />
      <section className="mx-auto max-w-2xl pt-6 text-center">
        <h1 className="text-4xl tracking-tight sm:text-5xl">Prospecte sem limite</h1>
        <p className="mt-3 text-ink/60">Comece grátis. Libere uma pesquisa por R$ 10 ou assine o Pro e use tudo, com CRM.</p>
      </section>

      <TabelaPlanos />

      {conta && conta.plano !== "gratis" && (
        <div className="glass mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-4 rounded-3xl p-5 text-sm">
          <div>
            <p className="font-medium">Seu plano: {conta.plano === "empresa" ? "Empresa" : conta.ciclo === "manual" ? "Pro" : `Pro ${conta.ciclo === "anual" ? "anual" : "mensal"}`}</p>
            <p className="text-ink/60">
              {conta.recorrente ? "Renovação automática no cartão" : "Sem renovação automática"}
              {conta.valido_ate && ` · acesso até ${new Date(conta.valido_ate).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
          {conta.recorrente && (
            <button type="button" onClick={cancelar} disabled={cancelando} className="h-10 rounded-full border border-ink/15 px-4 hover:bg-white">
              {cancelando ? "Cancelando…" : "Cancelar renovação"}
            </button>
          )}
        </div>
      )}

      <section className="mx-auto grid w-full max-w-4xl gap-3 pb-16 sm:grid-cols-2">
        {PERGUNTAS.map((q) => (
          <div key={q.p} className="glass rounded-3xl p-5">
            <p className="font-medium">{q.p}</p>
            <p className="mt-1.5 text-sm text-ink/60">{q.r}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

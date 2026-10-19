"use client";

import { Check, Radar, X } from "lucide-react";
import { useEffect } from "react";
import { fecharAcesso, useSessao } from "@/lib/sessao";
import { FormularioAcesso } from "./Entrar";

/** Pop-up de entrar/criar conta que aparece na primeira ação de quem ainda não tem login. */
export function ModalAcesso() {
  const { modal } = useSessao();

  useEffect(() => {
    if (!modal.aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecharAcesso();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [modal.aberto]);

  if (!modal.aberto) return null;
  const destino = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Entrar ou criar conta">
      <button type="button" aria-label="Fechar" onClick={fecharAcesso} className="absolute inset-0 bg-ink/40 backdrop-blur-[3px] [animation:aparecer_.2s_ease-out]" />
      <div className="relative grid max-h-[94dvh] w-full max-w-3xl overflow-hidden rounded-[var(--radius-panel)] bg-[#f3f6fb] shadow-2xl [animation:aparecer_.3s_ease-out] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden overflow-hidden bg-coal p-7 text-white md:flex md:flex-col">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-lime/25 blur-[90px]" />
          <span className="relative grid size-10 place-items-center rounded-full bg-lime text-ink"><Radar className="size-5" /></span>
          <h2 className="relative mt-auto text-3xl leading-tight tracking-tight">Falta pouco para ver <span className="text-lime">todas as empresas</span>.</h2>
          <ul className="relative mt-5 flex flex-col gap-2.5 text-sm text-white/75">
            {["Telefone, e-mail e endereço completos", "Filtros, mapa e busca por linguagem natural", "CRM kanban e WhatsApp em 1 clique", "Conta grátis, sem cartão"].map((t) => (
              <li key={t} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-lime text-ink"><Check className="size-3" /></span>{t}</li>
            ))}
          </ul>
        </aside>

        <section className="overflow-y-auto p-6 sm:p-8">
          <button type="button" onClick={fecharAcesso} aria-label="Fechar"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/80 text-ink/60 hover:text-ink">
            <X className="size-4" />
          </button>
          <p className="mb-1 text-xs text-ink/50">Radar B2B</p>
          <h3 className="mb-5 pr-10 text-xl leading-snug tracking-tight">{modal.motivo ?? "Entre ou crie sua conta para continuar"}</h3>
          <FormularioAcesso key={modal.modo} modoInicial={modal.modo} destinoConfirmacao={destino} onEntrou={() => {}} />
          <p className="mt-2 text-center text-[11px] text-ink/45">Seus leads e buscas ficam na sua conta. Só você tem acesso.</p>
        </section>
      </div>
    </div>
  );
}

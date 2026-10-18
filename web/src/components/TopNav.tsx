"use client";

import { Bell, KanbanSquare, LogOut, Radar, Search, Settings, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import Link from "next/link";
import { useCrm } from "@/lib/crm";
import { Popover, cx } from "./ui";

const PAGINAS = [
  { id: "prospeccao", rotulo: "Prospecção", href: "/", icone: Search },
  { id: "crm", rotulo: "CRM", href: "/crm", icone: KanbanSquare },
  { id: "automacao", rotulo: "Automação IA", href: "/automacao", icone: Sparkles },
] as const;

export function TopNav({ pagina }: { pagina: (typeof PAGINAS)[number]["id"] }) {
  const { leads } = useCrm();
  const abertos = leads.filter((l) => l.etapa !== "ganho" && l.etapa !== "perdido").length;

  return (
    <header className="flex flex-wrap items-center gap-3">
      <Link href="/" className="mr-4 flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-full bg-ink text-lime">
          <Radar className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">radar<span className="text-muted">b2b</span></span>
      </Link>

      <nav className="order-last flex w-full items-center gap-1 overflow-x-auto rounded-full bg-ink p-1.5 [scrollbar-width:none] md:order-none md:w-auto">
        {PAGINAS.map((p) => {
          const ativa = pagina === p.id;
          const Icone = p.icone;
          return (
            <Link
              key={p.id}
              href={p.href}
              className={cx(
                "flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition",
                ativa ? "bg-lime font-medium text-ink" : "text-white/75 hover:text-white",
              )}
            >
              <Icone className="size-4" />
              {p.rotulo}
              {p.id === "automacao" && !ativa && <span className="size-1.5 rounded-full bg-lime" aria-label="novo" />}
              {p.id === "crm" && abertos > 0 && (
                <span className={cx("rounded-full px-1.5 text-[11px]", ativa ? "bg-ink text-lime" : "bg-white/15")}>{abertos}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button type="button" aria-label="Notificações" className="grid size-11 place-items-center rounded-full border border-white/90 bg-white/70">
          <Bell className="size-4" />
        </button>
        <button type="button" aria-label="Configurações" className="grid size-11 place-items-center rounded-full border border-white/90 bg-white/70">
          <Settings className="size-4" />
        </button>
        <MenuUsuario />
      </div>
    </header>
  );
}

function MenuUsuario() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ email: string; nome: string } | null>(null);
  useEffect(() => {
    supabaseNavegador().auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setUsuario({ email: u.email ?? "", nome: (u.user_metadata?.nome as string) || (u.email ?? "").split("@")[0] });
    });
  }, []);
  const sair = async () => {
    await supabaseNavegador().auth.signOut();
    router.replace("/entrar");
    router.refresh();
  };
  const inicial = (usuario?.nome || "?").trim().charAt(0).toUpperCase();
  return (
    <Popover
      rotulo={<span className="hidden max-w-[120px] truncate sm:inline">{usuario?.nome ?? "Conta"}</span>}
      icone={<span className="grid size-7 place-items-center rounded-full bg-steel text-xs font-semibold text-white">{inicial}</span>}
      largura={260}
      alinhar="direita"
    >
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium">{usuario?.nome}</p>
        <p className="truncate text-xs text-muted">{usuario?.email}</p>
      </div>
      <button type="button" onClick={sair}
        className="mt-1 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm hover:bg-white/80">
        <LogOut className="size-4" /> Sair
      </button>
    </Popover>
  );
}

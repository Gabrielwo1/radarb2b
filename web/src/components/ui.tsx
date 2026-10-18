"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Gatilho em pílula + painel flutuante "vidro". Fecha com clique fora ou Esc. */
export function Popover({
  rotulo,
  ativo,
  icone,
  children,
  largura = 320,
  alinhar = "esquerda",
}: {
  rotulo: ReactNode;
  ativo?: boolean;
  icone?: ReactNode;
  children: ReactNode | ((fechar: () => void) => ReactNode);
  largura?: number;
  alinhar?: "esquerda" | "direita";
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={cx(
          "flex h-11 items-center gap-2 rounded-full border pl-4 pr-2 text-sm transition",
          ativo
            ? "border-ink bg-ink text-white"
            : "border-white/90 bg-white/70 text-ink/70 hover:bg-white",
        )}
      >
        {icone}
        <span className="max-w-[180px] truncate">{rotulo}</span>
        <span
          className={cx(
            "grid size-7 place-items-center rounded-full transition",
            ativo ? "bg-white/15" : "bg-mist",
            aberto && "rotate-180",
          )}
        >
          <ChevronDown className="size-3.5" />
        </span>
      </button>
      {aberto && (
        <div
          style={{ width: largura, maxWidth: "calc(100vw - 32px)" }}
          className={cx(
            "glass absolute top-[calc(100%+8px)] z-40 rounded-3xl p-3",
            alinhar === "direita" ? "right-0" : "left-0",
          )}
        >
          {typeof children === "function" ? children(() => setAberto(false)) : children}
        </div>
      )}
    </div>
  );
}

export function Check({ marcado, onChange, children, extra }: {
  marcado: boolean;
  onChange: () => void;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm hover:bg-white/80"
    >
      <span
        className={cx(
          "grid size-5 shrink-0 place-items-center rounded-md border transition",
          marcado ? "border-ink bg-ink text-lime" : "border-ink/20 bg-white",
        )}
      >
        {marcado && <span className="size-2 rounded-sm bg-lime" />}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {extra && <span className="text-xs text-muted">{extra}</span>}
    </button>
  );
}

export function Switch({ ligado, onChange, children }: { ligado: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-white/80"
    >
      {children}
      <span className={cx("relative h-6 w-10 rounded-full transition", ligado ? "bg-ink" : "bg-ink/15")}>
        <span
          className={cx(
            "absolute top-1 size-4 rounded-full transition-all",
            ligado ? "left-5 bg-lime" : "left-1 bg-white",
          )}
        />
      </span>
    </button>
  );
}

export function BotaoIcone({ children, onClick, titulo, escuro, href }: {
  children: ReactNode;
  onClick?: () => void;
  titulo: string;
  escuro?: boolean;
  href?: string;
}) {
  const classe = cx(
    "grid size-11 shrink-0 place-items-center rounded-full border transition",
    escuro
      ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
      : "border-white/90 bg-white/70 text-ink/70 hover:bg-white",
  );
  if (href) {
    return (
      <a href={href} title={titulo} aria-label={titulo} className={classe}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={titulo} aria-label={titulo} className={classe}>
      {children}
    </button>
  );
}

export function Contador({ n, claro }: { n: number; claro?: boolean }) {
  return (
    <span
      className={cx(
        "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-medium",
        claro ? "bg-white text-ink" : "bg-ink text-white",
      )}
    >
      {n}
    </span>
  );
}

/** Ícone do WhatsApp (balão verde com telefone). */
export function IconeWhatsApp({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" />
      <path
        fill="#fff"
        d="M16.9 14.4c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1a6.8 6.8 0 0 1-3.4-3c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.2.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.1.1-1.3l-.4-.2Z"
      />
    </svg>
  );
}

// Toasts: avisos curtos no canto da tela
type Toast = { id: number; texto: string; acao?: { rotulo: string; href: string } };
let toasts: Toast[] = [];
const ouvintesToast = new Set<() => void>();
export function avisar(texto: string, acao?: Toast["acao"]) {
  const t = { id: Date.now() + Math.random(), texto, acao };
  toasts = [...toasts, t];
  ouvintesToast.forEach((f) => f());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    ouvintesToast.forEach((f) => f());
  }, 4000);
}

export function Toasts() {
  const [, forcar] = useState(0);
  useEffect(() => {
    const f = () => forcar((n) => n + 1);
    ouvintesToast.add(f);
    return () => {
      ouvintesToast.delete(f);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2 pl-4 pr-2 text-sm text-white shadow-[0_16px_40px_-16px_rgb(20_21_24/0.7)]">
          <span className="size-2 rounded-full bg-lime" />
          {t.texto}
          {t.acao ? (
            <a href={t.acao.href} className="rounded-full bg-lime px-3 py-1 text-xs font-medium text-ink">{t.acao.rotulo}</a>
          ) : (
            <span className="w-1" />
          )}
        </div>
      ))}
    </div>
  );
}

import { linkEquipe } from "@/lib/contato";
import { IconeWhatsApp } from "./ui";

// Botão flutuante de contato com a equipe (WhatsApp), em todas as páginas. Só HTML: não pesa no carregamento.
export function WhatsAppFlutuante() {
  return (
    <a
      href={linkEquipe("Olá! Vim pelo site do Radar B2B e queria tirar uma dúvida.")}
      target="_blank"
      rel="noopener"
      aria-label="Falar com a equipe no WhatsApp"
      title="Falar com a equipe no WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex h-14 items-center gap-0 rounded-full bg-ink pl-4 pr-4 text-white shadow-[0_14px_30px_-10px_rgb(20_21_24/0.6)] ring-1 ring-white/10 transition-all hover:gap-2.5 hover:pr-5 print:hidden"
    >
      <IconeWhatsApp className="size-7 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 group-hover:max-w-[160px]">
        Fale com a equipe
      </span>
    </a>
  );
}

"use client";

import { Bot, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconeWhatsApp, cx } from "../ui";

// Celular com a conversa de exemplo da IA. Arquivo próprio para a landing não carregar a página de Automação.

type Msg = { de: "ia" | "lead" | "sistema"; texto: string };
const CONVERSA: Msg[] = [
  { de: "ia", texto: "Oi, Andressa! Aqui é a Júlia, da Rações Prime. Vi que vocês têm uma loja de artigos para animais em Curitiba. Posso te mandar nosso catálogo com condição de revenda?" },
  { de: "lead", texto: "Oi! Pode sim. Quais marcas vocês trabalham?" },
  { de: "ia", texto: "Temos 3 linhas premium e entregamos em até 48h na região. Quanto vocês costumam comprar por mês, mais ou menos?" },
  { de: "lead", texto: "Uns 40 sacos de 15 kg" },
  { de: "ia", texto: "Com esse volume você já entra na faixa de desconto de revenda. Posso agendar uma ligação rápida com nosso consultor amanhã às 10h?" },
  { de: "lead", texto: "Pode ser 👍" },
  { de: "sistema", texto: "Lead qualificado · movido para Negociação no CRM" },
];

export function Celular() {
  const [visiveis, setVisiveis] = useState(0);
  const [digitando, setDigitando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (!cancelado) {
        setVisiveis(0);
        await espera(900);
        for (let i = 0; i < CONVERSA.length && !cancelado; i++) {
          if (CONVERSA[i].de === "ia") {
            setDigitando(true);
            await espera(1400);
            setDigitando(false);
          } else {
            await espera(CONVERSA[i].de === "lead" ? 1100 : 700);
          }
          if (!cancelado) setVisiveis(i + 1);
          await espera(500);
        }
        await espera(4500);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    fim.current?.parentElement?.scrollTo({ top: fim.current.offsetTop, behavior: "smooth" });
  }, [visiveis, digitando]);

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="rounded-[44px] border border-white/10 bg-[#111214] p-3 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
        <div className="overflow-hidden rounded-[34px] bg-[#ece5dd]">
          <div className="flex items-center gap-3 bg-[#1f2c33] px-4 pb-3 pt-5 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-lime text-xs font-semibold text-ink">AI</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Pet Shop da Andressa</p>
              <p className="text-[11px] text-white/60">{digitando ? "Júlia (IA) está digitando…" : "Curitiba · PR"}</p>
            </div>
            <IconeWhatsApp className="size-5" />
          </div>

          <div className="scroll-thin flex h-[430px] flex-col gap-2 overflow-y-auto px-3 py-4">
            <span className="mx-auto rounded-lg bg-white/70 px-2.5 py-1 text-[10px] text-ink/60">Exemplo de conversa</span>
            {CONVERSA.slice(0, visiveis).map((m, i) =>
              m.de === "sistema" ? (
                <span key={i} className="mx-auto mt-1 flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] text-white [animation:aparecer_.35s_ease-out]">
                  <Check className="size-3 text-lime" /> {m.texto}
                </span>
              ) : (
                <p
                  key={i}
                  className={cx(
                    "max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug text-ink shadow-sm [animation:aparecer_.35s_ease-out]",
                    m.de === "ia" ? "self-start rounded-tl-sm bg-white" : "self-end rounded-tr-sm bg-[#d9fdd3]",
                  )}
                >
                  {m.texto}
                </p>
              ),
            )}
            {digitando && (
              <span className="flex w-14 items-center justify-center gap-1 self-start rounded-2xl rounded-tl-sm bg-white px-3 py-3 shadow-sm">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-ink/40" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            )}
            <div ref={fim} />
          </div>
        </div>
      </div>
      <span className="absolute -left-4 top-24 hidden rotate-[-6deg] items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-xs font-medium text-ink shadow-lg sm:flex">
        <Bot className="size-3.5" /> respondendo 24/7
      </span>
    </div>
  );
}

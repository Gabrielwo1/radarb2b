"use client";

import {
  ArrowDown, BadgeCheck, Bot, CalendarClock, Check, Clock, Filter, Hand, KanbanSquare, Lock, MessageSquareText,
  ShieldCheck, Sparkles, Target, UserRoundCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TopNav } from "../TopNav";
import { IconeWhatsApp, Toasts, avisar, cx } from "../ui";

// Contato da equipe para ativação (WhatsApp tem prioridade; e-mail como alternativa)
const WHATSAPP_EQUIPE = process.env.NEXT_PUBLIC_WHATSAPP_EQUIPE?.replace(/\D/g, "");
const EMAIL_EQUIPE = process.env.NEXT_PUBLIC_EMAIL_EQUIPE;
const MENSAGEM = "Olá! Quero ativar a Automação com IA do Radar B2B para prospecção ativa da minha lista.";

function falarComEquipe() {
  if (WHATSAPP_EQUIPE) window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(MENSAGEM)}`, "_blank", "noopener");
  else if (EMAIL_EQUIPE) window.location.href = `mailto:${EMAIL_EQUIPE}?subject=${encodeURIComponent("Ativar Automação com IA")}&body=${encodeURIComponent(MENSAGEM)}`;
  else avisar("Contato da equipe ainda não configurado (NEXT_PUBLIC_WHATSAPP_EQUIPE)");
}

function BotaoEquipe({ grande }: { grande?: boolean }) {
  return (
    <button
      type="button"
      onClick={falarComEquipe}
      className={cx(
        "group flex items-center gap-3 rounded-full bg-lime font-medium text-ink transition hover:bg-lime-deep",
        grande ? "h-14 pl-6 pr-2 text-base" : "h-12 pl-5 pr-1.5 text-sm",
      )}
    >
      Falar com a equipe para ativar
      <span className={cx("grid place-items-center rounded-full bg-ink transition group-hover:scale-105", grande ? "size-10" : "size-9")}>
        <IconeWhatsApp className={grande ? "size-6" : "size-5"} />
      </span>
    </button>
  );
}

export function Automacao() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <TopNav pagina="automacao" />
      <Toasts />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-coal p-6 text-white sm:p-10">
        <div className="pointer-events-none absolute -right-32 -top-40 size-[520px] rounded-full bg-lime/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 size-[420px] rounded-full bg-steel/30 blur-[110px]" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-start gap-6">
            <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80">
              <Sparkles className="size-3.5 text-lime" /> Automação com IA · ativação assistida pela equipe
            </span>
            <h1 className="text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              Sua lista de prospecção <span className="text-lime">conversando sozinha</span> no WhatsApp.
            </h1>
            <p className="max-w-xl text-base text-white/70">
              Um agente de IA aborda as empresas que você filtrou, adapta a conversa ao segmento de cada uma, responde dúvidas,
              qualifica o interesse e entrega no seu CRM só quem está pronto para conversar com um vendedor.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <BotaoEquipe grande />
              <a href="#como-funciona" className="flex h-14 items-center gap-2 rounded-full border border-white/15 px-6 text-sm text-white/80 hover:bg-white/5">
                Ver como funciona <ArrowDown className="size-4" />
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/55">
              <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Opt-out e LGPD</span>
              <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> Horário comercial</span>
              <span className="flex items-center gap-1.5"><Hand className="size-3.5" /> Passa para humano quando precisa</span>
            </div>
          </div>

          <Celular />
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-ink/55">Como funciona</p>
            <h2 className="mt-1 text-3xl tracking-tight">Da lista ao lead quente, em 4 passos</h2>
          </div>
        </div>
        <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="pointer-events-none absolute left-8 right-8 top-[46px] hidden h-px bg-gradient-to-r from-transparent via-ink/15 to-transparent xl:block" />
          {PASSOS.map((p, i) => (
            <article key={p.titulo} className={cx("glass relative flex flex-col gap-3 rounded-[var(--radius-card)] p-5", i === 3 && "ring-2 ring-lime")}>
              <div className="flex items-center gap-3">
                <span className={cx("grid size-12 place-items-center rounded-full", i === 3 ? "bg-lime text-ink" : "bg-ink text-lime")}>
                  <p.icone className="size-5" />
                </span>
                <span className="text-xs text-muted">Passo {i + 1}</span>
              </div>
              <h3 className="text-lg font-medium leading-snug">{p.titulo}</h3>
              <p className="text-sm text-ink/65">{p.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Prévia da configuração (bloqueada) + recursos */}
      <section className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <PreviaConfiguracao />
        <div className="grid gap-3 sm:grid-cols-2">
          {RECURSOS.map((r) => (
            <article key={r.titulo} className="glass flex flex-col gap-2 rounded-[var(--radius-card)] p-5">
              <span className="grid size-10 place-items-center rounded-full bg-mist"><r.icone className="size-[18px]" /></span>
              <h3 className="font-medium">{r.titulo}</h3>
              <p className="text-sm text-ink/60">{r.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-lime p-8 sm:p-10">
        <div className="hatch-dark pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl leading-tight tracking-tight sm:text-4xl">Pronto para colocar sua prospecção no piloto automático?</h2>
            <p className="mt-2 text-sm text-ink/70">
              A ativação é feita junto com a nossa equipe: conectamos o número de WhatsApp, ajustamos o roteiro ao seu produto e
              definimos limites seguros de envio.
            </p>
          </div>
          <button type="button" onClick={falarComEquipe}
            className="flex h-14 items-center gap-3 rounded-full bg-ink pl-6 pr-2 text-base font-medium text-white hover:bg-coal-2">
            Falar com a equipe
            <span className="grid size-10 place-items-center rounded-full bg-lime"><IconeWhatsApp className="size-6" /></span>
          </button>
        </div>
      </section>
    </main>
  );
}

const PASSOS = [
  { icone: Filter, titulo: "Escolha a lista", texto: "Use uma busca salva ou os filtros da prospecção: segmento, cidade, porte, só celulares." },
  { icone: MessageSquareText, titulo: "A IA faz a abordagem", texto: "Mensagem de abertura personalizada com nome, segmento e cidade, enviada em horário comercial." },
  { icone: Target, titulo: "Conversa e qualifica", texto: "Responde dúvidas sobre o seu produto, faz as perguntas de qualificação e entende o interesse." },
  { icone: KanbanSquare, titulo: "Entrega no seu CRM", texto: "Leads interessados entram em Negociação com resumo da conversa, e o vendedor é avisado." },
];

const RECURSOS = [
  { icone: Sparkles, titulo: "Roteiro por segmento", texto: "Uma padaria e uma clínica recebem abordagens diferentes, a partir do CNAE de cada empresa." },
  { icone: ShieldCheck, titulo: "LGPD e opt-out", texto: "Identificação clara de quem fala e saída imediata para quem pedir para não ser contatado." },
  { icone: CalendarClock, titulo: "Limites seguros", texto: "Volume diário controlado e intervalos naturais para proteger o seu número." },
  { icone: UserRoundCheck, titulo: "Humano quando precisa", texto: "Perguntas fora do roteiro ou negociação de preço passam para o seu time." },
  { icone: KanbanSquare, titulo: "CRM sempre atualizado", texto: "Cada conversa move o card de etapa e registra o resumo nas notas do lead." },
  { icone: BadgeCheck, titulo: "Você no controle", texto: "Pause, ajuste o roteiro ou aprove mensagens antes do envio quando quiser." },
];

function PreviaConfiguracao() {
  return (
    <article className="glass relative overflow-hidden rounded-[var(--radius-card)] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Prévia · campanha de exemplo</p>
          <h3 className="mt-0.5 text-xl tracking-tight">Nova campanha de prospecção</h3>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs text-white"><Bot className="size-3.5 text-lime" /> Agente IA</span>
      </div>

      <div className="mt-5 grid gap-3 opacity-70 [filter:saturate(0.9)]">
        <Campo rotulo="Lista de origem" valor="Pet shops e lojas de ração · Curitiba · só celulares" />
        <div className="rounded-2xl border border-white bg-white/70 p-3">
          <p className="text-[11px] text-muted">Mensagem de abertura</p>
          <p className="mt-1 text-sm leading-relaxed">
            Oi, <Var>nome</Var>! Aqui é a Júlia, da <Var>sua empresa</Var>. Vi que a <Var>nome_fantasia</Var> atua com{" "}
            <Var>segmento</Var> em <Var>cidade</Var>. Posso te mandar nosso catálogo com condição de revenda?
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Objetivo" valor="Agendar ligação" />
          <Campo rotulo="Tom de voz" valor="Consultivo" />
          <Campo rotulo="Horário de envio" valor="Seg–Sex · 9h às 18h" />
          <Campo rotulo="Limite diário" valor="80 novas conversas" />
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-white/40 via-white/75 to-white/90 p-6 text-center backdrop-blur-[2px]">
        <span className="grid size-12 place-items-center rounded-full bg-ink text-lime"><Lock className="size-5" /></span>
        <p className="text-lg font-medium tracking-tight">Disponível após a ativação</p>
        <p className="max-w-xs text-sm text-ink/60">A equipe configura o número de WhatsApp e o roteiro junto com você.</p>
        <BotaoEquipe />
      </div>
    </article>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/70 p-3">
      <p className="text-[11px] text-muted">{rotulo}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{valor}</p>
    </div>
  );
}

function Var({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-lime px-1.5 py-0.5 text-xs font-medium">{`{${children}}`}</span>;
}

// --- Conversa animada (exemplo ilustrativo) ---------------------------------

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

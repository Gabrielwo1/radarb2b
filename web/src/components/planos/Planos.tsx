"use client";

import { ArrowRight, Check, Crown, Gauge, Lock, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fecharPlanos, useBloqueio, useConta } from "@/lib/conta";
import { ANUAL_SEM_DESCONTO, LIMITES_GRATIS, type Motivo, PAGINAS_AVULSO, PRECOS } from "@/lib/planos";
import { IconeWhatsApp, cx } from "../ui";

const WHATSAPP_EQUIPE = process.env.NEXT_PUBLIC_WHATSAPP_EQUIPE?.replace(/\D/g, "");
export function falarComEquipe(texto = "Olá! Quero conhecer o plano Empresa do Radar B2B (tudo liberado + automação de WhatsApp).") {
  if (WHATSAPP_EQUIPE) window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  else window.location.href = "/automacao";
}

export const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v: number) => reais(v).replace(/,00$/, "");
export const urlCheckout = (tipo: string, chave?: string | null) =>
  `/checkout?plano=${tipo}${chave ? `&consulta=${encodeURIComponent(chave)}` : ""}`;

// ---------------------------------------------------------------------------
// Créditos no topo do app: deixa explícito quanto ainda resta no grátis

export function Creditos({ chave }: { chave?: string }) {
  const { conta, avulsa } = useConta();
  if (!conta) return null;

  if (conta.plano !== "gratis") {
    const ate = conta.valido_ate ? new Date(conta.valido_ate).toLocaleDateString("pt-BR") : null;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-full bg-ink py-1.5 pl-2 pr-4 text-sm text-white">
        <span className="flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-medium text-ink">
          <Crown className="size-3.5" /> {conta.plano === "empresa" ? "Empresa" : "Pro"}
        </span>
        <span className="text-white/75">Pesquisas, contatos, páginas e CRM ilimitados</span>
        {ate && <span className="text-white/50">· {conta.recorrente ? "renova" : "válido até"} {ate}</span>}
      </div>
    );
  }

  const pesquisas = Math.max(0, LIMITES_GRATIS.pesquisas - conta.pesquisas);
  const contatos = Math.max(0, LIMITES_GRATIS.contatos - conta.contatos);
  const acabou = pesquisas === 0 || contatos === 0;
  return (
    <div className={cx("flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[28px] p-2 pl-5 text-sm", acabou ? "bg-ink text-white" : "glass")}>
      <span className="flex items-center gap-2 font-medium">
        <Gauge className={cx("size-4", acabou ? "text-lime" : "text-ink/60")} /> Plano grátis
      </span>
      <Medidor rotulo="Pesquisas" resta={pesquisas} total={LIMITES_GRATIS.pesquisas} escuro={acabou} />
      <Medidor rotulo="Contatos" resta={contatos} total={LIMITES_GRATIS.contatos} escuro={acabou} />
      <span className={cx("text-xs", acabou ? "text-white/55" : "text-ink/55")}>Lista até a página {LIMITES_GRATIS.paginas} · CRM no Pro</span>
      {chave && avulsa(chave) && <span className="rounded-full bg-lime px-2.5 py-1 text-xs text-ink">Esta pesquisa está liberada</span>}
      {chave && !avulsa(chave) && (
        <Link href={urlCheckout("avulso", chave)} className={cx("rounded-full px-3 py-1.5 text-xs underline-offset-4 hover:underline", acabou ? "text-white/80" : "text-ink/70")}>
          Liberar só esta pesquisa · R$ 10
        </Link>
      )}
      {conta.avulsas.length > 0 && (
        <span className="rounded-full bg-lime px-2.5 py-1 text-xs text-ink">{conta.avulsas.length} consulta{conta.avulsas.length > 1 ? "s" : ""} avulsa{conta.avulsas.length > 1 ? "s" : ""} liberada{conta.avulsas.length > 1 ? "s" : ""}</span>
      )}
      <Link href="/planos" className="ml-auto flex h-10 items-center gap-2 rounded-full bg-lime pl-4 pr-1.5 text-sm font-medium text-ink hover:bg-lime-deep">
        Liberar tudo por {brl(PRECOS.pro_mensal.valor)}/mês
        <span className="grid size-7 place-items-center rounded-full bg-ink text-lime"><ArrowRight className="size-3.5" /></span>
      </Link>
    </div>
  );
}

function Medidor({ rotulo, resta, total, escuro }: { rotulo: string; resta: number; total: number; escuro: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={escuro ? "text-white/70" : "text-ink/60"}>{rotulo}</span>
      <span className={cx("h-2 w-20 overflow-hidden rounded-full", escuro ? "bg-white/15" : "bg-ink/10")}>
        <span className={cx("block h-full rounded-full", resta === 0 ? "bg-[#ff6b5e]" : "bar-lime")} style={{ width: `${(resta / total) * 100}%` }} />
      </span>
      <strong className="tabular-nums">{resta}/{total}</strong>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Janela "sem crédito" (aberta quando a API responde 402)

const TEXTOS: Record<Motivo, { titulo: string; sub: string }> = {
  pesquisas: { titulo: "Suas 5 pesquisas grátis acabaram", sub: "Libere só esta pesquisa por R$ 10 ou assine o Pro e pesquise à vontade." },
  contatos: { titulo: "Você abriu os 10 contatos grátis", sub: "Com o Pro você vê telefone, WhatsApp e e-mail de todas as empresas." },
  paginas: { titulo: "No grátis a lista vai até a página 2", sub: `Libere esta pesquisa até a página ${PAGINAS_AVULSO} por R$ 10, ou tudo com o Pro.` },
  paginas_avulso: { titulo: `A consulta avulsa vai até a página ${PAGINAS_AVULSO}`, sub: "Para ver a lista inteira, assine o Pro." },
  crm: { titulo: "O CRM faz parte do plano Pro", sub: "Monte seu funil, mova leads no kanban e acompanhe cada negociação." },
  exportar: { titulo: "Exportar a lista é pago", sub: "Exporte esta pesquisa por R$ 10 (até 600 empresas) ou exporte tudo com o Pro." },
  whatsapp: { titulo: "WhatsApp com IA é do plano Empresa", sub: "Nossa equipe configura a automação de prospecção para você." },
};

export function ModalPlanos() {
  const bloqueio = useBloqueio();
  useEffect(() => {
    if (!bloqueio) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecharPlanos();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [bloqueio]);
  if (!bloqueio) return null;
  const t = TEXTOS[bloqueio.motivo];
  const podeAvulso = !!bloqueio.chave && ["pesquisas", "paginas", "exportar"].includes(bloqueio.motivo);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t.titulo}>
      <button type="button" aria-label="Fechar" onClick={fecharPlanos} className="absolute inset-0 bg-ink/40 backdrop-blur-[3px] [animation:aparecer_.2s_ease-out]" />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[var(--radius-panel)] bg-[#f3f6fb] p-6 shadow-2xl [animation:aparecer_.3s_ease-out] sm:p-8">
        <button type="button" onClick={fecharPlanos} aria-label="Fechar" className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/80 text-ink/60 hover:text-ink">
          <X className="size-4" />
        </button>
        <span className="grid size-11 place-items-center rounded-full bg-ink text-lime"><Lock className="size-5" /></span>
        <h3 className="mt-4 pr-10 text-2xl tracking-tight">{t.titulo}</h3>
        <p className="mt-1 text-sm text-ink/60">{t.sub}</p>

        <div className={cx("mt-6 grid gap-3", podeAvulso && "sm:grid-cols-2")}>
          {podeAvulso && (
            <Link href={urlCheckout("avulso", bloqueio.chave)} onClick={fecharPlanos} className="glass group flex flex-col rounded-3xl p-5 transition hover:bg-white">
              <span className="text-xs text-muted">Só esta pesquisa</span>
              <span className="mt-1 text-3xl tracking-tight">R$ 10</span>
              <span className="mt-2 text-sm text-ink/65">Até {PAGINAS_AVULSO} páginas, contatos completos e exportação · 30 dias</span>
              <span className="mt-4 flex items-center gap-1.5 text-sm font-medium">Liberar pesquisa <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
          )}
          {bloqueio.motivo === "whatsapp" ? (
            <button type="button" onClick={() => falarComEquipe()} className="flex items-center justify-between rounded-3xl bg-ink p-5 text-left text-white">
              <span><span className="text-lg">Falar com a equipe</span><br /><span className="text-sm text-white/60">Plano Empresa sob medida</span></span>
              <IconeWhatsApp className="size-7" />
            </button>
          ) : (
            <Link href={urlCheckout("pro_anual")} onClick={fecharPlanos} className="group relative flex flex-col overflow-hidden rounded-3xl bg-ink p-5 text-white">
              <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-lime/20 blur-[50px]" />
              <span className="flex items-center gap-2 text-xs text-white/60">Pro · tudo liberado <span className="rounded-full bg-lime px-2 py-0.5 font-medium text-ink">-40% no anual</span></span>
              <span className="mt-1 text-3xl tracking-tight">12x {reais(PRECOS.pro_anual.valor / 12)}</span>
              <span className="mt-2 text-sm text-white/65">ou {brl(PRECOS.pro_mensal.valor)}/mês · pesquisas, contatos e páginas ilimitados + CRM</span>
              <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-lime">Assinar o Pro <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
          )}
        </div>
        <Link href="/planos" onClick={fecharPlanos} className="mt-4 block text-center text-sm text-ink/60 underline-offset-4 hover:underline">Comparar todos os planos</Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela de planos (página /planos)

export function TabelaPlanos() {
  const [anual, setAnual] = useState(true);
  const { conta, temPlano } = useConta();

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-center gap-1 rounded-full bg-ink p-1 text-sm">
        {[{ v: false, r: "Mensal" }, { v: true, r: "Anual" }].map((o) => (
          <button key={o.r} type="button" onClick={() => setAnual(o.v)}
            className={cx("flex h-10 items-center gap-2 rounded-full px-5 transition", anual === o.v ? "bg-lime font-medium text-ink" : "text-white/70 hover:text-white")}>
            {o.r}{o.v && <span className={cx("rounded-full px-2 py-0.5 text-[11px]", anual ? "bg-ink text-lime" : "bg-lime text-ink")}>-40%</span>}
          </button>
        ))}
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-4">
        <Cartao
          nome="Grátis" preco="R$ 0" detalhe="para testar"
          itens={[`${LIMITES_GRATIS.pesquisas} pesquisas`, `${LIMITES_GRATIS.contatos} contatos abertos`, `Lista até a página ${LIMITES_GRATIS.paginas}`, "Mapa de calor e filtros"]}
          sem={["CRM", "Exportar CSV"]}
          acao={conta?.plano === "gratis" ? <Botao desabilitado>Seu plano atual</Botao> : <Botao href="/app">Começar grátis</Botao>}
        />
        <Cartao
          nome="Consulta avulsa" preco="R$ 10" detalhe="por pesquisa · Pix ou cartão"
          itens={[`Uma pesquisa liberada por 30 dias`, `Até ${PAGINAS_AVULSO} páginas (${PAGINAS_AVULSO * 30} empresas)`, "Telefone, WhatsApp e e-mail", "Exportar a lista em CSV"]}
          sem={["CRM"]}
          acao={<Botao href="/app">Escolher a pesquisa no app</Botao>}
          nota="Faça a pesquisa no app e toque em “Liberar esta pesquisa”."
        />
        <Cartao
          destaque
          nome="Pro" selo={anual ? "Mais escolhido · -40%" : "Mais escolhido"}
          preco={anual ? `12x ${reais(PRECOS.pro_anual.valor / 12)}` : `${brl(PRECOS.pro_mensal.valor)}/mês`}
          riscado={anual ? `de ${reais(ANUAL_SEM_DESCONTO)} por ${reais(PRECOS.pro_anual.valor)} no ano` : undefined}
          detalhe={anual ? "cartão em até 12x ou Pix à vista" : "cartão (renova sozinho) ou Pix (30 dias)"}
          itens={["Pesquisas ilimitadas", "Contatos ilimitados", "Todas as páginas", "CRM kanban completo", "Exportar CSV (até 20 mil)", "WhatsApp em 1 clique"]}
          acao={temPlano ? <Botao desabilitado>Plano ativo</Botao> : <Botao href={urlCheckout(anual ? "pro_anual" : "pro_mensal")} lime>Assinar o Pro</Botao>}
        />
        <Cartao
          nome="Empresa" preco="Sob consulta" detalhe="para times comerciais"
          itens={["Tudo do Pro", "Automação de WhatsApp com IA", "Vários usuários", "Implantação com a equipe"]}
          acao={<Botao onClick={() => falarComEquipe()}>Falar com a equipe <IconeWhatsApp className="size-4" /></Botao>}
        />
      </div>
    </div>
  );
}

function Cartao({ nome, preco, detalhe, itens, sem = [], acao, destaque, selo, riscado, nota }: {
  nome: string; preco: string; detalhe: string; itens: string[]; sem?: string[]; acao: React.ReactNode;
  destaque?: boolean; selo?: string; riscado?: string; nota?: string;
}) {
  return (
    <div className={cx("relative flex flex-col overflow-hidden rounded-[var(--radius-card)] p-6", destaque ? "bg-coal text-white lg:-my-3 lg:py-9" : "glass")}>
      {destaque && <span className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-lime/20 blur-[70px]" />}
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg">{nome}</p>
        {selo && <span className="flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[11px] font-medium text-ink"><Sparkles className="size-3" />{selo}</span>}
      </div>
      <p className="mt-4 text-3xl tracking-tight">{preco}</p>
      {riscado && <p className="mt-1 text-xs text-lime">{riscado}</p>}
      <p className={cx("mt-1 text-xs", destaque ? "text-white/55" : "text-muted")}>{detalhe}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm">
        {itens.map((i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", destaque ? "bg-lime text-ink" : "bg-ink text-lime")}><Check className="size-3" /></span>{i}
          </li>
        ))}
        {sem.map((i) => (
          <li key={i} className={cx("flex items-start gap-2.5", destaque ? "text-white/35" : "text-ink/35")}>
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-current"><X className="size-3" /></span>{i}
          </li>
        ))}
      </ul>
      <div className="mt-6">{acao}</div>
      {nota && <p className="mt-2 text-[11px] text-muted">{nota}</p>}
    </div>
  );
}

function Botao({ children, href, onClick, lime, desabilitado }: { children: React.ReactNode; href?: string; onClick?: () => void; lime?: boolean; desabilitado?: boolean }) {
  const cls = cx("flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition",
    desabilitado ? "cursor-default border border-current/20 bg-transparent opacity-60" : lime ? "bg-lime text-ink hover:bg-lime-deep" : "bg-ink text-white hover:bg-coal-2");
  if (href && !desabilitado) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} disabled={desabilitado} className={cls}>{children}</button>;
}


"use client";

import { AlarmClock, CalendarClock, KanbanSquare, Plus, Search, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { abrirAcesso, useSessao } from "@/lib/sessao";
import { ETAPAS, type EtapaId, type Lead, atualizarLead, recarregarCrm, useCrm } from "@/lib/crm";
import { ehCelular, escala, linkWhatsApp, iniciais, moeda, nomeProprio, porcentagem, tom } from "@/lib/formato";
import { tituloCidade } from "../Filtros";
import { TopNav } from "../TopNav";
import { IconeWhatsApp, Toasts, avisar, cx } from "../ui";
import { LeadPainel } from "./LeadPainel";

const hoje = () => new Date().toISOString().slice(0, 10);
const semAcento = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ABERTAS: EtapaId[] = ["novo", "contato", "qualificado", "proposta", "negociacao"];

export function Crm() {
  const { leads, carregado } = useCrm();
  const sessao = useSessao();
  // Visitante: o funil é da conta, então abre o pop-up de acesso direto
  useEffect(() => {
    if (sessao.carregado && !sessao.usuario) abrirAcesso("criar", "Crie sua conta grátis para organizar seus leads no CRM");
  }, [sessao.carregado, sessao.usuario]);
  useEffect(() => {
    if (sessao.usuario) recarregarCrm().catch(() => {});
  }, [sessao.usuario]);
  const [busca, setBusca] = useState("");
  const [soFollowUp, setSoFollowUp] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ etapa: EtapaId; antesDe: string | null } | null>(null);

  const filtrados = useMemo(() => {
    const t = semAcento(busca.trim());
    return leads.filter((l) => {
      if (soFollowUp && !(l.proxima_acao && l.proxima_acao <= hoje())) return false;
      if (!t) return true;
      const d = l.dados;
      return semAcento(`${d.razao_social ?? ""} ${d.nome_fantasia ?? ""} ${d.municipio ?? ""} ${d.cnae_descricao ?? ""} ${l.cnpj}`).includes(t);
    });
  }, [leads, busca, soFollowUp]);

  const porEtapa = useMemo(() => {
    const m = new Map<EtapaId, Lead[]>(ETAPAS.map((e) => [e.id, []]));
    for (const l of [...filtrados].sort((a, b) => a.ordem - b.ordem)) m.get(l.etapa)?.push(l);
    return m;
  }, [filtrados]);

  const k = useMemo(() => {
    const abertos = leads.filter((l) => ABERTAS.includes(l.etapa));
    const ganhos = leads.filter((l) => l.etapa === "ganho");
    const perdidos = leads.filter((l) => l.etapa === "perdido");
    const soma = (ls: Lead[]) => ls.reduce((s, l) => s + Number(l.valor ?? 0), 0);
    return {
      abertos: abertos.length,
      valorAberto: soma(abertos),
      negociando: leads.filter((l) => l.etapa === "proposta" || l.etapa === "negociacao").length,
      ganhos: ganhos.length,
      valorGanho: soma(ganhos),
      conversao: ganhos.length + perdidos.length ? porcentagem(ganhos.length, ganhos.length + perdidos.length) : "—",
      atrasados: abertos.filter((l) => l.proxima_acao && l.proxima_acao < hoje()).length,
      hoje: abertos.filter((l) => l.proxima_acao === hoje()).length,
    };
  }, [leads]);

  // Solta o card: antes de outro card (ordem entre vizinhos) ou no fim da coluna
  const soltar = (etapa: EtapaId, antesDe: string | null) => {
    const cnpj = arrastando;
    setArrastando(null);
    setAlvo(null);
    if (!cnpj || cnpj === antesDe) return;
    const coluna = (porEtapa.get(etapa) ?? []).filter((l) => l.cnpj !== cnpj);
    const i = antesDe ? coluna.findIndex((l) => l.cnpj === antesDe) : -1;
    let ordem: number;
    if (i === -1) ordem = (coluna.at(-1)?.ordem ?? 0) + 1;
    else ordem = i === 0 ? coluna[0].ordem - 1 : (coluna[i - 1].ordem + coluna[i].ordem) / 2;
    const lead = leads.find((l) => l.cnpj === cnpj);
    atualizarLead(cnpj, { etapa, ordem })
      .then(() => lead && lead.etapa !== etapa && avisar(`Movido para ${ETAPAS.find((e) => e.id === etapa)!.rotulo}`))
      .catch((e) => avisar(`Não foi possível mover: ${e.message}`));
  };

  const leadAberto = leads.find((l) => l.cnpj === aberto);

  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <TopNav pagina="crm" />
      <Toasts />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs text-ink/60"><KanbanSquare className="size-3.5" /> Funil de vendas</p>
          <h1 className="mt-1 text-5xl tracking-tight">Pipeline</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-11 w-64 items-center gap-2 rounded-full border border-white/90 bg-white/70 px-4">
            <Search className="size-4 text-muted" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no funil"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" />
            {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar"><X className="size-4 text-muted" /></button>}
          </div>
          <button type="button" onClick={() => setSoFollowUp((v) => !v)}
            className={cx("flex h-11 items-center gap-2 rounded-full px-4 text-sm transition",
              soFollowUp ? "bg-ink text-white" : "border border-white/90 bg-white/70 text-ink/70 hover:bg-white")}>
            <AlarmClock className="size-4" /> Follow-ups de hoje
            {k.atrasados + k.hoje > 0 && <span className={cx("rounded-full px-1.5 text-[11px]", soFollowUp ? "bg-lime text-ink" : "bg-ink text-white")}>{k.atrasados + k.hoje}</span>}
          </button>
          <Link href="/" className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm text-white hover:bg-coal-2">
            <Plus className="size-4 text-lime" /> Buscar empresas
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <section className="glass grid grid-cols-2 gap-5 rounded-[var(--radius-card)] p-6 md:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Leads em aberto" valor={escala(k.abertos)} />
        <Kpi rotulo="Valor em aberto" valor={moeda(k.valorAberto)} />
        <Kpi rotulo="Em proposta / negociação" valor={escala(k.negociando)} />
        <Kpi rotulo="Ganhos" valor={escala(k.ganhos)} sub={k.valorGanho ? moeda(k.valorGanho) : undefined} destaque />
        <Kpi rotulo="Taxa de conversão" valor={k.conversao} sub="ganhos ÷ encerrados" />
        <Kpi rotulo="Follow-ups atrasados" valor={escala(k.atrasados)} alerta={k.atrasados > 0} sub={k.hoje ? `${k.hoje} para hoje` : undefined} />
      </section>

      {/* Quadro */}
      {carregado && leads.length === 0 ? (
        <Vazio />
      ) : (
        <div className="scroll-thin -mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {ETAPAS.map((e) => {
            const cards = porEtapa.get(e.id) ?? [];
            const total = cards.reduce((s, l) => s + Number(l.valor ?? 0), 0);
            const sobre = alvo?.etapa === e.id;
            return (
              <section
                key={e.id}
                onDragOver={(ev) => { ev.preventDefault(); if (alvo?.etapa !== e.id || alvo.antesDe !== null) setAlvo({ etapa: e.id, antesDe: null }); }}
                onDrop={(ev) => { ev.preventDefault(); soltar(e.id, alvo?.etapa === e.id ? alvo.antesDe : null); }}
                className={cx("flex w-[296px] shrink-0 flex-col rounded-[28px] p-2 transition-shadow", sobre && "ring-2 ring-ink/20")}
                style={{ background: e.fundo }}
              >
                <header className="relative mb-2 overflow-hidden rounded-[22px] bg-white/70 px-4 pb-3 pt-4">
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: e.cor }} />
                  <div className="flex items-center justify-between">
                    <h2 className="font-medium">{e.rotulo}</h2>
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-xs text-white">{cards.length}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{total ? moeda(total) : "sem valor estimado"}</p>
                </header>

                <div className="flex min-h-24 flex-col gap-2">
                  {cards.map((l) => (
                    <CardLead
                      key={l.cnpj}
                      lead={l}
                      arrastando={arrastando === l.cnpj}
                      marcadorAntes={alvo?.etapa === e.id && alvo.antesDe === l.cnpj && arrastando !== l.cnpj}
                      onAbrir={() => setAberto(l.cnpj)}
                      onDragStart={() => setArrastando(l.cnpj)}
                      onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                      onDragOverCard={() => { if (alvo?.antesDe !== l.cnpj) setAlvo({ etapa: e.id, antesDe: l.cnpj }); }}
                    />
                  ))}
                  {sobre && alvo?.antesDe === null && arrastando && <div className="h-1 rounded-full bg-ink/40" />}
                  {cards.length === 0 && (
                    <div className="hatch-dark grid h-36 place-items-center rounded-3xl border border-dashed border-ink/10 p-6 text-center text-xs text-ink/45">
                      {e.id === "ganho" ? (<span className="flex flex-col items-center gap-1"><Trophy className="size-4" /> Arraste aqui os negócios fechados</span>) : "Arraste empresas para cá"}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {leadAberto && <LeadPainel lead={leadAberto} onFechar={() => setAberto(null)} />}
    </main>
  );
}

function CardLead({ lead, arrastando, marcadorAntes, onAbrir, onDragStart, onDragEnd, onDragOverCard }: {
  lead: Lead;
  arrastando: boolean;
  marcadorAntes: boolean;
  onAbrir: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: () => void;
}) {
  const d = lead.dados;
  const nome = nomeProprio(d.nome_fantasia || d.razao_social);
  const celular = [d.telefone1, d.telefone2].find(ehCelular);
  const atrasado = lead.proxima_acao && lead.proxima_acao < hoje();
  const ehHoje = lead.proxima_acao === hoje();

  return (
    <>
      {marcadorAntes && <div className="h-1 rounded-full bg-ink/40" />}
      <article
        draggable
        onDragStart={(ev) => { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", lead.cnpj); onDragStart(); }}
        onDragEnd={onDragEnd}
        onDragOver={(ev) => { ev.preventDefault(); ev.stopPropagation(); onDragOverCard(); }}
        onClick={onAbrir}
        className={cx(
          "group cursor-grab rounded-3xl border border-white bg-white/90 p-3.5 shadow-[0_6px_20px_-14px_rgb(20_21_24/0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgb(20_21_24/0.55)] active:cursor-grabbing",
          arrastando && "opacity-40",
          lead.etapa === "perdido" && "opacity-70",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-ink" style={{ background: tom(lead.cnpj) }}>
            {iniciais(d.nome_fantasia || d.razao_social)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug" title={nome}>{nome}</p>
            <p className="truncate text-xs text-muted">{d.municipio ? tituloCidade(d.municipio) : "—"} · {d.uf}</p>
          </div>
          {celular && (
            <a
              href={linkWhatsApp(celular)}
              target="_blank"
              rel="noreferrer"
              onClick={(ev) => {
                ev.stopPropagation();
                if (lead.etapa === "novo") atualizarLead(lead.cnpj, { etapa: "contato" }).catch(() => {});
              }}
              title="Chamar no WhatsApp"
              aria-label="Chamar no WhatsApp"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-mist transition hover:scale-110"
            >
              <IconeWhatsApp className="size-4" />
            </a>
          )}
        </div>

        {d.cnae_descricao && <p className="mt-2 line-clamp-1 text-xs text-ink/60" title={d.cnae_descricao}>{d.cnae_descricao}</p>}

        <div className="mt-2.5 flex flex-wrap gap-1">
          {d.mei ? <Tag>MEI</Tag> : d.simples ? <Tag>Simples</Tag> : null}
          {d.porte === 3 && <Tag>EPP</Tag>}
          {d.porte === 5 && <Tag>Médio/grande</Tag>}
          {lead.origem === "whatsapp" && <Tag>via WhatsApp</Tag>}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink/5 pt-2.5 text-xs">
          <span className={cx("font-semibold", !lead.valor && "font-normal text-muted")}>{lead.valor ? moeda(lead.valor) : "sem valor"}</span>
          {lead.proxima_acao ? (
            <span className={cx("flex items-center gap-1 rounded-full px-2 py-0.5",
              atrasado ? "bg-[#ffe1dc] text-[#b4232a]" : ehHoje ? "bg-lime text-ink" : "bg-mist text-ink/70")}>
              <CalendarClock className="size-3" />
              {ehHoje ? "hoje" : lead.proxima_acao.split("-").reverse().slice(0, 2).join("/")}
            </span>
          ) : (
            <span className="text-muted">{tempoRelativo(lead.atualizado_em)}</span>
          )}
        </div>
      </article>
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] text-ink/70">{children}</span>;
}

function Kpi({ rotulo, valor, sub, destaque, alerta }: { rotulo: string; valor: string; sub?: string; destaque?: boolean; alerta?: boolean }) {
  return (
    <div>
      <p className="text-sm text-ink/60">{rotulo}</p>
      <p className={cx("mt-2 inline-block text-[28px] leading-none tracking-tight tabular-nums",
        destaque && "rounded-xl bg-lime px-2 py-1", alerta && "text-[#b4232a]")}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Vazio() {
  return (
    <section className="glass flex flex-col items-center gap-4 rounded-[var(--radius-card)] px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-ink text-lime"><KanbanSquare className="size-6" /></span>
      <h2 className="text-2xl tracking-tight">Seu funil está vazio</h2>
      <p className="max-w-md text-sm text-ink/60">
        Na prospecção, clique em <strong>+ CRM</strong> numa empresa, selecione várias e use <strong>Adicionar ao CRM</strong>, ou chame pelo
        WhatsApp: a empresa entra aqui automaticamente.
      </p>
      <Link href="/" className="flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-medium text-ink hover:bg-lime-deep">
        <Search className="size-4" /> Buscar empresas
      </Link>
    </section>
  );
}

function tempoRelativo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

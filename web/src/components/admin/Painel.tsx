"use client";

import { ArrowLeft, Download, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { telefone as fmtTelefone, linkWhatsApp, numero } from "@/lib/formato";
import { IconeWhatsApp, cx } from "../ui";

// Painel de gestão (/admin): visão geral (números, gráficos de 30 dias, planos, funil, pagamentos) e contas.

type Serie = { dia: string; cadastros: number; ativos: number; pesquisas: number; receita: number };
type Visao = {
  contas: number; confirmadas: number; novas_7d: number; novas_30d: number;
  ativos_hoje: number; ativos_7d: number; ativos_30d: number;
  planos: { pro_mensal: number; pro_anual: number; empresa: number; recorrentes: number; avulsas_ativas: number };
  mrr: number; receita_30d: number; receita_total: number;
  vendas: { avulso: number; pro_mensal: number; pro_anual: number; pix_pendentes: number };
  uso: { pesquisas: number; contatos: number; leads_crm: number };
  funil: { cadastros: number; confirmaram: number; pesquisaram: number; esgotaram: number; pagaram: number };
  series: Serie[];
  pagamentos: { id: string; tipo: string; valor: number; status: string; metodo: string | null; criado_em: string; email: string }[];
};
type Conta = {
  id: string; email: string; nome: string | null; telefone: string | null; created_at: string; last_sign_in_at: string | null;
  email_confirmed_at: string | null; plano: string; valido_ate: string | null; recorrente: boolean;
  pesquisas: number; contatos: number; leads: number; pago: number; ultimo_acesso: string | null;
};

const reais = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR") : "—");
const dataHora = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

const PLANOS: Record<string, { rotulo: string; classe: string }> = {
  gratis: { rotulo: "Grátis", classe: "border border-ink/15 text-ink/70" },
  pro_mensal: { rotulo: "Pro mensal", classe: "bg-ink text-lime" },
  pro_anual: { rotulo: "Pro anual", classe: "bg-lime text-ink" },
  empresa: { rotulo: "Empresa", classe: "bg-steel text-white" },
};
const TIPOS: Record<string, string> = { avulso: "Avulso", pro_mensal: "Pro mensal", pro_anual: "Pro anual" };
const STATUS: Record<string, string> = { approved: "Aprovado", pending: "Pendente", rejected: "Recusado", cancelled: "Cancelado", refunded: "Estornado", in_process: "Em análise" };

async function buscar<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`);
  return corpo as T;
}

export function Painel() {
  const [aba, setAba] = useState<"visao" | "contas">("visao");
  const [visao, setVisao] = useState<Visao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizado, setAtualizado] = useState<Date | null>(null);

  const carregar = () => {
    setErro(null);
    buscar<Visao>("/api/admin/painel").then((v) => { setVisao(v); setAtualizado(new Date()); }).catch((e) => setErro(e.message));
  };
  useEffect(carregar, []);

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/app" className="grid size-10 place-items-center rounded-full border border-white bg-white/70 hover:bg-white" aria-label="Voltar ao app">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="text-xs text-muted">Radar B2B · gestão</p>
          <h1 className="text-2xl tracking-tight">Painel de gestão</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-ink p-1 text-sm md:ml-6">
          {([["visao", "Visão geral"], ["contas", "Contas"]] as const).map(([id, r]) => (
            <button key={id} type="button" onClick={() => setAba(id)}
              className={cx("h-9 rounded-full px-4 transition", aba === id ? "bg-lime font-medium text-ink" : "text-white/70 hover:text-white")}>{r}</button>
          ))}
        </div>
        <button type="button" onClick={carregar} className="ml-auto flex h-10 items-center gap-2 rounded-full border border-white bg-white/70 px-4 text-sm hover:bg-white">
          <RefreshCw className="size-4" /> {atualizado ? `Atualizado ${atualizado.toLocaleTimeString("pt-BR", { timeStyle: "short" })}` : "Atualizar"}
        </button>
      </header>

      {erro && <p className="rounded-3xl bg-[#fde8e6] p-4 text-sm text-[#9c2b22]">{erro}</p>}
      {aba === "visao" ? (visao ? <VisaoGeral v={visao} /> : !erro && <div className="glass skeleton h-96 rounded-[var(--radius-card)]" />) : <Contas />}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Visão geral

function VisaoGeral({ v }: { v: Visao }) {
  const pagantes = v.planos.pro_mensal + v.planos.pro_anual + v.planos.empresa;
  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Contas criadas" valor={numero(v.contas)} sub={`+${v.novas_7d} em 7 dias · +${v.novas_30d} em 30`} />
        <Numero rotulo="Ativos" valor={numero(v.ativos_7d)} sub={`hoje ${v.ativos_hoje} · 30 dias ${v.ativos_30d}`} legenda="últimos 7 dias" />
        <Numero rotulo="MRR" valor={reais(v.mrr)} sub={`${pagantes} pagantes · ${v.planos.recorrentes} no cartão recorrente`} escuro />
        <Numero rotulo="Receita" valor={reais(v.receita_30d)} sub={`total ${reais(v.receita_total)}`} legenda="últimos 30 dias" />
        <Numero rotulo="Conversão" valor={pct(v.funil.pagaram, v.contas)} sub={`${v.funil.pagaram} de ${v.contas} contas já pagaram`} />
        <Numero rotulo="Pesquisas" valor={numero(v.uso.pesquisas)} sub={`${numero(v.uso.contatos)} contatos abertos no grátis`} />
        <Numero rotulo="Leads no CRM" valor={numero(v.uso.leads_crm)} sub="somando todas as contas" />
        <Numero rotulo="Vendas" valor={numero(v.vendas.avulso + v.vendas.pro_mensal + v.vendas.pro_anual)}
          sub={`${v.vendas.avulso} avulso · ${v.vendas.pro_mensal} mensal · ${v.vendas.pro_anual} anual${v.vendas.pix_pendentes ? ` · ${v.vendas.pix_pendentes} Pix pendente` : ""}`} />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Grafico titulo="Cadastros por dia" series={v.series} campo="cadastros" />
        <Grafico titulo="Usuários ativos por dia" series={v.series} campo="ativos" />
        <Grafico titulo="Pesquisas por dia" series={v.series} campo="pesquisas" />
        <Grafico titulo="Receita por dia" series={v.series} campo="receita" formato={reais} />
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr]">
        <Cartao titulo="Planos ativos">
          <Barras itens={[
            { rotulo: "Grátis", valor: Math.max(0, v.contas - pagantes) },
            { rotulo: "Pro mensal", valor: v.planos.pro_mensal },
            { rotulo: "Pro anual", valor: v.planos.pro_anual },
            { rotulo: "Empresa", valor: v.planos.empresa },
            { rotulo: "Consultas avulsas ativas", valor: v.planos.avulsas_ativas },
          ]} />
        </Cartao>
        <Cartao titulo="Funil de conversão">
          <Barras itens={[
            { rotulo: "Cadastros", valor: v.funil.cadastros },
            { rotulo: "Confirmaram o e-mail", valor: v.funil.confirmaram },
            { rotulo: "Fizeram pesquisa", valor: v.funil.pesquisaram },
            { rotulo: "Esgotaram o grátis", valor: v.funil.esgotaram },
            { rotulo: "Pagaram", valor: v.funil.pagaram },
          ]} base={v.funil.cadastros} />
        </Cartao>
        <Cartao titulo="Últimos pagamentos">
          {v.pagamentos.length ? (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {v.pagamentos.map((p) => (
                    <tr key={p.id} className="border-t border-ink/5 first:border-0">
                      <td className="py-2 pr-3"><p className="max-w-[180px] truncate">{p.email}</p><p className="text-xs text-muted">{dataHora(p.criado_em)}</p></td>
                      <td className="py-2 pr-3 text-ink/70">{TIPOS[p.tipo] ?? p.tipo}<p className="text-xs text-muted">{p.metodo === "pix" ? "Pix" : "Cartão"}</p></td>
                      <td className="py-2 pr-3 text-right tabular-nums">{reais(p.valor)}</td>
                      <td className="py-2 text-right"><Status s={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">Nenhum pagamento ainda.</p>}
        </Cartao>
      </section>
    </>
  );
}

function Numero({ rotulo, valor, sub, legenda, escuro }: { rotulo: string; valor: string; sub?: string; legenda?: string; escuro?: boolean }) {
  return (
    <div className={cx("rounded-[var(--radius-card)] p-5", escuro ? "bg-coal text-white" : "glass")}>
      <p className={cx("text-xs", escuro ? "text-white/55" : "text-muted")}>{rotulo}{legenda && ` · ${legenda}`}</p>
      <p className={cx("mt-1 text-3xl tracking-tight tabular-nums", escuro && "text-lime")}>{valor}</p>
      {sub && <p className={cx("mt-1 text-xs", escuro ? "text-white/55" : "text-ink/55")}>{sub}</p>}
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-[var(--radius-card)] p-5">
      <p className="mb-4 font-medium">{titulo}</p>
      {children}
    </div>
  );
}

function Status({ s }: { s: string }) {
  const cor = s === "approved" ? "bg-lime text-ink" : s === "pending" ? "bg-[#fdf1c7] text-[#7a5a00]" : "border border-ink/15 text-ink/60";
  return <span className={cx("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs", cor)}>{STATUS[s] ?? s}</span>;
}

/** Barras verticais de 30 dias (uma série), com dica ao passar o mouse. */
function Grafico({ titulo, series, campo, formato = numero }: {
  titulo: string; series: Serie[]; campo: keyof Omit<Serie, "dia">; formato?: (v: number) => string;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  const valores = series.map((s) => Number(s[campo]));
  const max = Math.max(1, ...valores);
  const total = valores.reduce((a, b) => a + b, 0);
  const L = 600, A = 150, gap = 2, larg = L / valores.length;
  const f = foco != null ? series[foco] : null;

  return (
    <div className="glass rounded-[var(--radius-card)] p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm tabular-nums text-ink/60">
          {f ? <>{data(f.dia)}: <strong className="text-ink">{formato(Number(f[campo]))}</strong></> : <>30 dias: <strong className="text-ink">{formato(total)}</strong></>}
        </p>
      </div>
      <svg viewBox={`0 0 ${L} ${A + 18}`} className="w-full" role="img" aria-label={`${titulo}: ${formato(total)} em 30 dias`} onMouseLeave={() => setFoco(null)}>
        <line x1="0" x2={L} y1={A} y2={A} stroke="currentColor" className="text-ink/15" />
        <line x1="0" x2={L} y1="1" y2="1" stroke="currentColor" strokeDasharray="3 4" className="text-ink/10" />
        <text x={L} y="12" textAnchor="end" className="fill-ink/40 text-[11px]">{formato(max)}</text>
        {valores.map((val, i) => {
          const h = val ? Math.max(3, (val / max) * (A - 16)) : 0;
          return (
            <g key={series[i].dia} onMouseEnter={() => setFoco(i)}>
              <rect x={i * larg} y="0" width={larg} height={A} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${i * larg + gap / 2},${A} v${-(h - 4)} q0,-4 4,-4 h${larg - gap - 8} q4,0 4,4 v${h - 4} z`}
                  className={foco === i ? "fill-ink" : "fill-steel"}
                />
              )}
            </g>
          );
        })}
        <text x="0" y={A + 15} className="fill-ink/40 text-[11px]">{data(series[0]?.dia)}</text>
        <text x={L} y={A + 15} textAnchor="end" className="fill-ink/40 text-[11px]">{data(series.at(-1)?.dia)}</text>
      </svg>
    </div>
  );
}

/** Barras horizontais com rótulo e valor (planos, funil). */
function Barras({ itens, base }: { itens: { rotulo: string; valor: number }[]; base?: number }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="flex flex-col gap-3">
      {itens.map((i) => (
        <div key={i.rotulo}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-ink/75">{i.rotulo}</span>
            <span className="tabular-nums">{numero(i.valor)}{base ? <span className="text-ink/45"> · {pct(i.valor, base)}</span> : null}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-ink/8"><div className="h-full rounded-full bg-steel" style={{ width: `${(i.valor / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contas

const FILTROS = [["", "Todas"], ["pagantes", "Pagantes"], ["gratis", "Grátis"], ["pro_mensal", "Pro mensal"], ["pro_anual", "Pro anual"], ["empresa", "Empresa"]] as const;

function Contas() {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [plano, setPlano] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<{ total: number; contas: Conta[] } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setTermo(busca); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => {
    const q = new URLSearchParams({ busca: termo, plano, pagina: String(pagina) });
    buscar<{ total: number; contas: Conta[] }>(`/api/admin/contas?${q}`).then(setDados).catch(() => setDados({ total: 0, contas: [] }));
  }, [termo, plano, pagina]);

  const exportar = () => {
    if (!dados) return;
    const cab = ["nome", "email", "telefone", "plano", "criada", "ultimo_acesso", "pesquisas", "contatos", "leads", "pago"];
    const linhas = dados.contas.map((c) => [c.nome, c.email, c.telefone, PLANOS[c.plano]?.rotulo ?? c.plano, data(c.created_at), data(c.ultimo_acesso), c.pesquisas, c.contatos, c.leads, c.pago]);
    const csv = "﻿" + [cab, ...linhas].map((l) => l.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `contas-radar-b2b-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const paginas = dados ? Math.max(1, Math.ceil(dados.total / 50)) : 1;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="glass flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-full px-4 sm:max-w-sm">
          <Search className="size-4 text-ink/40" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone"
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" />
        </label>
        <div className="flex flex-wrap gap-1">
          {FILTROS.map(([id, r]) => (
            <button key={id} type="button" onClick={() => { setPlano(id); setPagina(1); }}
              className={cx("h-9 rounded-full px-3.5 text-sm transition", plano === id ? "bg-ink text-white" : "border border-white bg-white/60 hover:bg-white")}>{r}</button>
          ))}
        </div>
        <button type="button" onClick={exportar} className="ml-auto flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm text-white hover:bg-coal-2">
          <Download className="size-4" /> Exportar CSV
        </button>
      </div>

      <div className="glass overflow-x-auto rounded-[var(--radius-card)] p-2">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>{["Conta", "Telefone", "Plano", "Criada", "Último acesso", "Pesquisas", "Contatos", "Leads", "Pago"].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {dados?.contas.map((c) => (
              <tr key={c.id} onClick={() => setAberta(c.id)} className="cursor-pointer border-t border-ink/5 hover:bg-white/70">
                <td className="px-3 py-2.5">
                  <p className="font-medium">{c.nome || "—"}</p>
                  <p className="text-xs text-muted">{c.email}{!c.email_confirmed_at && " · não confirmado"}</p>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  {c.telefone ? (
                    <a href={linkWhatsApp(c.telefone)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 hover:underline">
                      {fmtTelefone(c.telefone)} <IconeWhatsApp className="size-3.5" />
                    </a>
                  ) : "—"}
                </td>
                <td className="px-3 py-2.5"><Plano p={c.plano} />{c.valido_ate && c.plano !== "gratis" && <p className="mt-0.5 text-[11px] text-muted">{c.recorrente ? "renova" : "até"} {data(c.valido_ate)}</p>}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{data(c.created_at)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{data(c.ultimo_acesso ?? c.last_sign_in_at)}</td>
                <td className="px-3 py-2.5 tabular-nums">{c.pesquisas}</td>
                <td className="px-3 py-2.5 tabular-nums">{c.contatos}</td>
                <td className="px-3 py-2.5 tabular-nums">{c.leads}</td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{c.pago ? reais(c.pago) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!dados && <div className="skeleton m-2 h-40 rounded-2xl" />}
        {dados && !dados.contas.length && <p className="p-6 text-center text-sm text-muted">Nenhuma conta encontrada.</p>}
      </div>

      <div className="flex items-center justify-between text-sm text-ink/60">
        <span>{dados ? `${numero(dados.total)} conta${dados.total === 1 ? "" : "s"}` : "…"}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="h-9 rounded-full border border-white bg-white/60 px-3 disabled:opacity-40">Anterior</button>
          <span>{pagina} / {paginas}</span>
          <button type="button" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)} className="h-9 rounded-full border border-white bg-white/60 px-3 disabled:opacity-40">Próxima</button>
        </div>
      </div>

      {aberta && <FichaConta id={aberta} onFechar={() => setAberta(null)} />}
    </section>
  );
}

function Plano({ p }: { p: string }) {
  const info = PLANOS[p] ?? { rotulo: p, classe: "border border-ink/15" };
  return <span className={cx("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs", info.classe)}>{info.rotulo}</span>;
}

// ---------------------------------------------------------------------------
// Ficha da conta (painel lateral)

type Ficha = {
  id: string; email: string; nome: string | null; telefone: string | null; empresa: string | null; provedor: string | null;
  criado_em: string; ultimo_login: string | null; confirmado_em: string | null; recebe_dicas: boolean | null;
  assinatura: { plano: string; ciclo: string; valido_ate: string; recorrente: boolean; mp_preapproval_id: string | null } | null;
  pagamentos: { id: string; tipo: string; valor: number; status: string; metodo: string | null; criado_em: string }[];
  avulsas: { chave: string; valido_ate: string }[];
  pesquisas: { chave: string; em: string }[];
  contatos: number; crm: Record<string, number>; favoritos: number; buscas_salvas: number;
  acessos: string[]; emails: { tipo: string; em: string }[];
};

const ETAPAS: Record<string, string> = { novo: "Novos", contato: "Em contato", qualificado: "Qualificados", proposta: "Proposta", negociacao: "Negociação", ganho: "Ganhos", perdido: "Perdidos" };

/** "cnae=4721102&municipio=7535&uf=PR" → "UF PR · cidade 7535 · CNAE 4721102" */
function resumirBusca(chave: string) {
  const q = new URLSearchParams(chave);
  const partes: string[] = [];
  const rot: Record<string, string> = { uf: "UF", municipio: "cidade", cnae: "CNAE", porte: "porte", q: "nome", bairro: "bairro", aba: "aba" };
  for (const [k, v] of q) partes.push(`${rot[k] ?? k} ${v.length > 30 ? `${v.slice(0, 30)}…` : v}`);
  return partes.join(" · ") || "Todas as empresas";
}

function FichaConta({ id, onFechar }: { id: string; onFechar: () => void }) {
  const [f, setF] = useState<Ficha | null>(null);
  useEffect(() => {
    setF(null);
    buscar<Ficha>(`/api/admin/contas/${id}`).then(setF).catch(() => {});
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [id, onFechar]);

  const ativoPlano = f?.assinatura && new Date(f.assinatura.valido_ate) > new Date();
  const totalPago = useMemo(() => (f?.pagamentos ?? []).filter((p) => p.status === "approved").reduce((a, p) => a + Number(p.valor), 0), [f]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Detalhes da conta">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[#f3f6fb] p-6 shadow-2xl [animation:aparecer_.25s_ease-out]">
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/80"><X className="size-4" /></button>
        {!f ? <div className="skeleton mt-10 h-64 rounded-3xl" /> : (
          <div className="flex flex-col gap-4">
            <div className="pr-10">
              <p className="text-xs text-muted">Conta</p>
              <h2 className="text-2xl tracking-tight">{f.nome || f.email}</h2>
              <p className="text-sm text-ink/60">{f.email}</p>
              {f.telefone && (
                <a href={linkWhatsApp(f.telefone)} target="_blank" rel="noopener" className="mt-2 inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-sm text-white">
                  <IconeWhatsApp className="size-4" /> {fmtTelefone(f.telefone)}
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info r="Criada em" v={dataHora(f.criado_em)} />
              <Info r="Último login" v={dataHora(f.ultimo_login)} />
              <Info r="E-mail confirmado" v={f.confirmado_em ? data(f.confirmado_em) : "Não"} />
              <Info r="Entrou com" v={f.provedor ?? "e-mail"} />
              <Info r="Dias com acesso (60d)" v={String(f.acessos.length)} />
              <Info r="Recebe dicas" v={f.recebe_dicas === false ? "Não (descadastrou)" : "Sim"} />
            </div>

            <div className="rounded-3xl bg-coal p-5 text-white">
              <p className="text-xs text-white/55">Plano</p>
              <p className="mt-1 text-xl">{ativoPlano ? (f.assinatura!.plano === "empresa" || f.assinatura!.ciclo === "manual" ? "Empresa" : `Pro ${f.assinatura!.ciclo}`) : "Grátis"}</p>
              {f.assinatura && <p className="text-sm text-white/60">{f.assinatura.recorrente ? "Renova no cartão" : "Sem renovação automática"} · {ativoPlano ? "até" : "venceu em"} {data(f.assinatura.valido_ate)}</p>}
              <p className="mt-3 text-sm text-white/70">Total pago: <strong className="text-lime">{reais(totalPago)}</strong></p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Info r="Pesquisas" v={String(f.pesquisas.length)} />
              <Info r="Contatos abertos" v={String(f.contatos)} />
              <Info r="Favoritos" v={String(f.favoritos)} />
            </div>

            {Object.keys(f.crm).length > 0 && (
              <Secao titulo="CRM">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(f.crm).map(([e, n]) => <span key={e} className="rounded-full bg-white px-3 py-1 text-xs">{ETAPAS[e] ?? e}: <strong>{n}</strong></span>)}
                </div>
              </Secao>
            )}

            <Secao titulo={`Pagamentos (${f.pagamentos.length})`}>
              {f.pagamentos.length ? f.pagamentos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-t border-ink/5 py-2 text-sm first:border-0">
                  <span>{TIPOS[p.tipo] ?? p.tipo}<span className="block text-xs text-muted">{dataHora(p.criado_em)} · {p.metodo === "pix" ? "Pix" : "Cartão"} · #{p.id}</span></span>
                  <span className="text-right tabular-nums">{reais(p.valor)}<span className="block"><Status s={p.status} /></span></span>
                </div>
              )) : <p className="text-sm text-muted">Nenhum pagamento.</p>}
            </Secao>

            <Secao titulo={`Pesquisas (${f.pesquisas.length})`}>
              {f.pesquisas.length ? f.pesquisas.slice(0, 15).map((s) => (
                <div key={s.chave} className="border-t border-ink/5 py-2 text-sm first:border-0">
                  <a href={`/app?${s.chave}`} target="_blank" rel="noopener" className="hover:underline">{resumirBusca(s.chave)}</a>
                  <span className="block text-xs text-muted">{dataHora(s.em)}{f.avulsas.some((a) => a.chave === s.chave) && " · avulsa paga"}</span>
                </div>
              )) : <p className="text-sm text-muted">Ainda não pesquisou.</p>}
            </Secao>

            <Secao titulo="E-mails enviados">
              {f.emails.length ? (
                <div className="flex flex-wrap gap-1.5">{f.emails.map((e) => <span key={e.tipo + e.em} className="rounded-full bg-white px-3 py-1 text-xs" title={dataHora(e.em)}>{e.tipo.replace(/_/g, " ")}</span>)}</div>
              ) : <p className="text-sm text-muted">Nenhum ainda.</p>}
            </Secao>
          </div>
        )}
      </aside>
    </div>
  );
}

function Info({ r, v }: { r: string; v: string }) {
  return <div className="rounded-2xl bg-white/70 p-3"><p className="text-xs text-muted">{r}</p><p className="mt-0.5 truncate">{v}</p></div>;
}
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <div className="rounded-3xl bg-white/70 p-4"><p className="mb-2 text-sm font-medium">{titulo}</p>{children}</div>;
}

"use client";

import { ArrowDownUp, ArrowRight, Download, KanbanSquare, Lock, Plus, Star } from "lucide-react";
import { abrirAcesso } from "@/lib/sessao";
import Link from "next/link";
import { useState } from "react";
import type { Empresa } from "@/lib/api";
import { type EtapaId, etapa as infoEtapa } from "@/lib/crm";
import type { Aba } from "@/lib/filtros";
import { cep, cnpj as fmtCnpj, ehCelular, enderecoCurto, iniciais, moeda, nomeProprio, escala, numero, telefone, tom } from "@/lib/formato";
import { tituloCidade } from "./Filtros";
import { BotaoIcone, IconeWhatsApp, Popover, cx } from "./ui";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "telefone", rotulo: "Com telefone" },
  { id: "novas", rotulo: "Novas" },
  { id: "salvos", rotulo: "Salvos" },
];

const ORDENS = [
  { id: "nome", rotulo: "Nome (A–Z)" },
  { id: "abertura_desc", rotulo: "Mais recentes" },
  { id: "abertura_asc", rotulo: "Mais antigas" },
  { id: "capital_desc", rotulo: "Maior capital social" },
];

const PORTE_CURTO: Record<number, string> = { 1: "ME", 3: "EPP", 5: "Demais" };

export function PainelProspects({
  aba, onAba, total, empresas, carregando, temMais, onMais, selecionado, onSelecionar,
  ordem, onOrdem, onExportar, ehSalvo, onSalvar, totalSalvos, etapasCrm, onCrm, onWhatsApp, bloqueado, children,
}: {
  aba: Aba;
  onAba: (a: Aba) => void;
  total: number | null;
  empresas: Empresa[];
  carregando: boolean;
  temMais: boolean;
  onMais: () => void;
  selecionado: string | null;
  onSelecionar: (cnpj: string | null) => void;
  ordem: string;
  onOrdem: (o: string) => void;
  onExportar: () => void;
  /** Visitante sem login: mostra a prévia e o convite para criar conta */
  bloqueado?: boolean;
  ehSalvo: (cnpj: string) => boolean;
  onSalvar: (e: Empresa) => void;
  etapasCrm: Map<string, EtapaId>;
  onCrm: (cnpjs: string[]) => void;
  onWhatsApp: (e: Empresa) => void;
  totalSalvos: number;
  children: React.ReactNode;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const todosMarcados = empresas.length > 0 && empresas.every((e) => marcados.has(e.cnpj));

  const alternarMarcado = (cnpj: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(cnpj)) n.delete(cnpj);
      else n.add(cnpj);
      return n;
    });

  const salvarMarcados = () => {
    empresas.filter((e) => marcados.has(e.cnpj) && !ehSalvo(e.cnpj)).forEach(onSalvar);
    setMarcados(new Set());
  };

  return (
    <section className="relative mt-10 rounded-[var(--radius-panel)] bg-coal p-4 pt-6 text-white sm:p-6">
      {/* Abas no "entalhe" superior, como na referência */}
      <div className="absolute -top-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-b-[26px] rounded-t-[22px] bg-[#eef3fa] p-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAba(a.id)}
            className={cx(
              "flex h-10 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap transition",
              aba === a.id ? "border-lime bg-lime font-medium text-ink" : "border-white bg-white text-ink/70 hover:text-ink",
            )}
          >
            {a.rotulo}
            {a.id === "salvos" && totalSalvos > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] text-white">{totalSalvos}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 px-2">
        <div>
          <h2 className="text-lg">Prospects</h2>
          <p className="text-sm text-white/50">
            {total == null ? "Carregando…" : <span title={numero(total)}>{escala(total)} empresas nesta busca</span>}
            {empresas.length > 0 && total != null && ` · exibindo ${numero(empresas.length)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-ink">
          {marcados.size > 0 && (
            <>
              <button type="button" onClick={() => { onCrm([...marcados]); setMarcados(new Set()); }}
                className="flex h-11 items-center gap-2 rounded-full bg-lime px-4 text-sm font-medium text-ink hover:bg-lime-deep">
                <KanbanSquare className="size-4" /> Adicionar {marcados.size} ao CRM
              </button>
              <button type="button" onClick={salvarMarcados} title="Salvar nos favoritos"
                className="flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-white/80 hover:bg-white/5">
                <Star className="size-4" /> Salvar
              </button>
            </>
          )}
          <Popover rotulo={ORDENS.find((o) => o.id === ordem)?.rotulo ?? "Ordenar"} icone={<ArrowDownUp className="size-4" />} largura={240} alinhar="direita">
            {(fechar) =>
              ORDENS.map((o) => (
                <button key={o.id} type="button" onClick={() => { onOrdem(o.id); fechar(); }}
                  className={cx("block w-full rounded-2xl px-3 py-2 text-left text-sm hover:bg-white/80", o.id === ordem && "font-medium")}>
                  {o.rotulo}
                </button>
              ))
            }
          </Popover>
          {aba !== "salvos" && (
            <BotaoIcone escuro titulo="Exportar CSV (até 5.000)" onClick={onExportar}>
              <Download className="size-4" />
            </BotaoIcone>
          )}
        </div>
      </div>

      <div className={cx("mt-5 grid items-start gap-4", selecionado && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        <div className="scroll-thin max-h-[72vh] overflow-auto rounded-3xl">
          <table className="w-full min-w-[1420px] border-separate border-spacing-y-1.5 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-coal text-xs text-white/45">
              <tr>
                <th className="sticky left-0 z-20 w-10 min-w-10 bg-coal py-2 pl-3 font-normal">
                  <Caixa marcado={todosMarcados} onChange={() => setMarcados(todosMarcados ? new Set() : new Set(empresas.map((e) => e.cnpj)))} />
                </th>
                <Th className="sticky left-10 z-20 bg-coal">Empresa</Th>
                <Th>CNPJ</Th>
                <Th>Segmento</Th>
                <Th>Endereço</Th>
                <Th>Cidade</Th>
                <Th>Telefone</Th>
                <Th>E-mail</Th>
                <Th className="text-right">Capital social</Th>
                <Th>Porte</Th>
                <Th>Abertura</Th>
                <Th>Regime</Th>
                <Th>CRM</Th>
                <th className="w-12 pr-3" />
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <Linha
                  key={e.cnpj}
                  e={e}
                  ativo={e.cnpj === selecionado}
                  marcado={marcados.has(e.cnpj)}
                  salvo={ehSalvo(e.cnpj)}
                  onClick={() => onSelecionar(e.cnpj === selecionado ? null : e.cnpj)}
                  onMarcar={() => alternarMarcado(e.cnpj)}
                  onSalvar={() => onSalvar(e)}
                  etapaCrm={etapasCrm.get(e.cnpj)}
                  onCrm={() => onCrm([e.cnpj])}
                  onWhatsApp={() => onWhatsApp(e)}
                />
              ))}
              {carregando &&
                Array.from({ length: empresas.length ? 2 : 8 }, (_, i) => (
                  <tr key={`s${i}`}><td colSpan={14}><div className="skeleton-dark h-14 rounded-2xl" /></td></tr>
                ))}
            </tbody>
          </table>

          {bloqueado && total != null && total > empresas.length && (
            <div className="sticky left-0 mt-2 flex w-full flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-coal-2 to-coal p-5">
              <div className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-lime text-ink"><Lock className="size-5" /></span>
                <div>
                  <p className="text-lg tracking-tight">Mais {escala(total - empresas.length)} empresas nesta busca</p>
                  <p className="text-sm text-white/55">Crie sua conta grátis para ver todas, com telefone, e-mail e endereço completos.</p>
                </div>
              </div>
              <button type="button" onClick={() => abrirAcesso("criar", "Crie sua conta grátis para ver todas as empresas")}
                className="flex h-12 items-center gap-3 rounded-full bg-lime pl-5 pr-1.5 text-sm font-medium text-ink hover:bg-lime-deep">
                Criar conta grátis <span className="grid size-9 place-items-center rounded-full bg-ink text-lime"><ArrowRight className="size-4" /></span>
              </button>
            </div>
          )}
          {!carregando && !empresas.length && (
            <div className="hatch grid place-items-center rounded-3xl border border-white/10 px-6 py-16 text-center text-sm text-white/60">
              {aba === "salvos" ? "Você ainda não salvou nenhuma empresa. Use a estrela na tabela." : "Nenhuma empresa com esses filtros. Tente remover algum."}
            </div>
          )}
          {temMais && !carregando && (
            <button type="button" onClick={onMais} className="sticky left-0 mt-2 h-11 w-full rounded-full border border-white/15 text-sm text-white/80 hover:bg-white/5">
              Carregar mais
            </button>
          )}
        </div>

        {selecionado && <div className="xl:sticky xl:top-24">{children}</div>}
      </div>
    </section>
  );
}

/** "419••••21" (máscara do servidor) → "(41) 9••••-••21" */
const foneMascarado = (t: string) => `(${t.slice(0, 2)}) ${t.slice(2, 3)}••••-••${t.slice(-2)}`;

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cx("whitespace-nowrap px-3 py-2 font-normal", className)}>{children}</th>;
}

function Caixa({ marcado, onChange }: { marcado: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label="Selecionar"
      onClick={(ev) => { ev.stopPropagation(); onChange(); }}
      className={cx(
        "grid size-5 place-items-center rounded-md border transition",
        marcado ? "border-lime bg-lime" : "border-white/25 hover:border-white/50",
      )}
    >
      {marcado && <span className="size-2 rounded-sm bg-ink" />}
    </button>
  );
}

function Linha({ e, ativo, marcado, salvo, onClick, onMarcar, onSalvar, etapaCrm, onCrm, onWhatsApp }: {
  etapaCrm?: EtapaId;
  onCrm: () => void;
  onWhatsApp: () => void;
  e: Empresa;
  ativo: boolean;
  marcado: boolean;
  salvo: boolean;
  onClick: () => void;
  onMarcar: () => void;
  onSalvar: () => void;
}) {
  const nome = nomeProprio(e.nome_fantasia || e.razao_social);
  // Prévia de visitante: dados já vêm mascarados do servidor
  const oculto = e.cnpj.startsWith("oculto-");
  const regime = e.mei ? "MEI" : e.simples ? "Simples" : "Normal";
  const fundo = ativo ? "bg-steel" : "bg-coal-2 group-hover:bg-coal-3";
  const sub = ativo ? "text-white/80" : "text-white/45";
  const td = cx("px-3 py-2.5 align-middle transition-colors", fundo);

  return (
    <tr onClick={onClick} className="group cursor-pointer">
      <td className={cx(td, "sticky left-0 z-[1] w-10 min-w-10 rounded-l-2xl pl-3")}><Caixa marcado={marcado} onChange={onMarcar} /></td>

      <td className={cx(td, "sticky left-10 z-[1] max-w-[260px] shadow-[8px_0_12px_-10px_rgb(0_0_0/0.6)]")}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-ink" style={{ background: tom(e.cnpj) }}>
            {iniciais(e.nome_fantasia || e.razao_social)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium" title={nome}>{nome}</p>
            {e.nome_fantasia && <p className={cx("truncate text-xs", sub)} title={e.razao_social ?? ""}>{nomeProprio(e.razao_social)}</p>}
          </div>
        </div>
      </td>

      <td className={cx(td, "whitespace-nowrap tabular-nums", sub)}>{oculto ? "••.•••.•••/••••-••" : fmtCnpj(e.cnpj)}</td>

      <td className={cx(td, "max-w-[220px]")}>
        <p className="tabular-nums">#{e.cnae_principal}</p>
        <p className={cx("truncate text-xs", sub)} title={e.cnae_descricao ?? ""}>{e.cnae_descricao}</p>
      </td>

      <td className={cx(td, "max-w-[220px]")}>
        <p className="truncate" title={enderecoCurto(e)}>{enderecoCurto(e) || "—"}</p>
        <p className={cx("truncate text-xs", sub)}>{[e.bairro && nomeProprio(e.bairro), cep(e.cep)].filter(Boolean).join(" · ")}</p>
      </td>

      <td className={cx(td, "whitespace-nowrap")}>{e.municipio ? tituloCidade(e.municipio) : "—"}<span className={sub}> · {e.uf}</span></td>

      <td className={cx(td, "whitespace-nowrap tabular-nums")}>
        {e.telefone1 ? (
          <div className="flex items-center gap-1.5">
            {oculto ? foneMascarado(e.telefone1) : telefone(e.telefone1)}
            {(oculto ? e.telefone1[2] === "9" : ehCelular(e.telefone1)) && (
              <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); onWhatsApp(); }}
                title="Chamar no WhatsApp (entra no CRM em “Em contato”)"
                aria-label="Chamar no WhatsApp"
                className="grid size-7 place-items-center rounded-full bg-white/10 transition hover:scale-110 hover:bg-white/20"
              >
                <IconeWhatsApp className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <span className="hatch rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/40">sem telefone</span>
        )}
        {e.telefone2 && <p className={cx("text-xs", sub)}>{telefone(e.telefone2)}</p>}
      </td>

      <td className={cx(td, "max-w-[220px]")}>
        {e.email ? <p className="truncate" title={e.email}>{e.email}</p> : <span className={sub}>—</span>}
      </td>

      <td className={cx(td, "whitespace-nowrap text-right tabular-nums")}>{moeda(e.capital_social)}</td>

      <td className={cx(td, "whitespace-nowrap")}>
        <span className={cx("rounded-full px-2.5 py-0.5 text-xs", ativo ? "bg-white text-ink" : "border border-white/15 text-white/75")}>
          {e.porte != null ? PORTE_CURTO[e.porte] ?? "—" : "—"}
        </span>
      </td>

      <td className={cx(td, "whitespace-nowrap tabular-nums")}>
        {e.data_abertura ? e.data_abertura.split("-").reverse().join("/") : "—"}
      </td>

      <td className={cx(td, "whitespace-nowrap")}>
        <span className={cx(
          "rounded-full px-2.5 py-0.5 text-xs",
          regime === "Normal" ? "hatch border border-white/15 text-white/60" : ativo ? "bg-white text-ink" : "bg-white/10 text-white/85",
        )}>
          {regime}
        </span>
      </td>

      <td className={cx(td, "whitespace-nowrap")}>
        {etapaCrm ? (
          <Link href="/crm" onClick={(ev) => ev.stopPropagation()} title="Ver no CRM"
            className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs", ativo ? "bg-white text-ink" : "bg-white/10 text-white/90 hover:bg-white/20")}>
            <span className="size-2 rounded-full" style={{ background: infoEtapa(etapaCrm).cor }} />
            {infoEtapa(etapaCrm).rotulo}
          </Link>
        ) : (
          <button type="button" onClick={(ev) => { ev.stopPropagation(); onCrm(); }} title="Adicionar ao CRM"
            className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition", ativo ? "border-white bg-white/20" : "border-white/20 text-white/70 hover:border-lime hover:text-lime")}>
            <Plus className="size-3" /> CRM
          </button>
        )}
      </td>

      <td className={cx(td, "rounded-r-2xl pr-3")}>
        <button
          type="button"
          onClick={(ev) => { ev.stopPropagation(); onSalvar(); }}
          aria-label={salvo ? "Remover dos salvos" : "Salvar"}
          title={salvo ? "Remover dos salvos" : "Salvar"}
          className="grid size-8 place-items-center rounded-full hover:bg-white/10"
        >
          <Star className={cx("size-4", salvo ? "fill-lime text-lime" : "text-white/40")} />
        </button>
      </td>
    </tr>
  );
}

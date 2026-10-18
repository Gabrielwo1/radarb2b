"use client";

import { ArrowUpRight, CalendarClock, Check as CheckIcon, Copy, Mail, MapPin, Phone, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ETAPAS, type Lead, atualizarLead, removerLead } from "@/lib/crm";
import { cep, cnpj as fmtCnpj, data, ehCelular, linkWhatsApp, idade, iniciais, moeda, nomeProprio, telefone, tom } from "@/lib/formato";
import { tituloCidade } from "../Filtros";
import { IconeWhatsApp, avisar, cx } from "../ui";

const PORTE: Record<number, string> = { 1: "Microempresa", 3: "Pequeno porte", 5: "Médio/grande" };

/** Gaveta lateral com o lead: etapa, valor, próximo follow-up, notas e contato. */
export function LeadPainel({ lead, onFechar }: { lead: Lead; onFechar: () => void }) {
  const d = lead.dados;
  const nome = nomeProprio(d.nome_fantasia || d.razao_social);
  const fones = [d.telefone1, d.telefone2].filter(Boolean) as string[];
  const celular = fones.find(ehCelular);
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [valor, setValor] = useState(lead.valor ?? "");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setNotas(lead.notas ?? "");
    setValor(lead.valor ?? "");
  }, [lead.cnpj]);

  // Autosave das notas enquanto digita; ao fechar (X, Esc, clique fora) grava o que estiver pendente
  const salvo = useRef({ notas: lead.notas ?? "", valor: lead.valor ?? "" });
  const atual = useRef({ notas, valor });
  atual.current = { notas, valor };
  const gravarPendente = useCallback(() => {
    const m: Parameters<typeof atualizarLead>[1] = {};
    if (atual.current.notas !== salvo.current.notas) m.notas = atual.current.notas;
    if (atual.current.valor !== salvo.current.valor) m.valor = atual.current.valor === "" ? null : atual.current.valor;
    if (!Object.keys(m).length) return;
    salvo.current = { ...atual.current };
    atualizarLead(lead.cnpj, m).catch((e) => avisar(`Não foi possível salvar: ${e.message}`));
  }, [lead.cnpj]);

  useEffect(() => {
    const t = setTimeout(gravarPendente, 700);
    return () => clearTimeout(t);
  }, [notas, gravarPendente]);
  useEffect(() => () => gravarPendente(), [gravarPendente]);

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  const salvar = (mudancas: Parameters<typeof atualizarLead>[1]) =>
    atualizarLead(lead.cnpj, mudancas).catch((e) => avisar(`Não foi possível salvar: ${e.message}`));

  const copiar = async () => {
    await navigator.clipboard.writeText(fmtCnpj(lead.cnpj));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" />
      <aside className="relative m-2 flex w-full max-w-[440px] flex-col gap-4 overflow-y-auto rounded-[var(--radius-panel)] bg-steel p-5 text-white shadow-2xl sm:m-3">
        <header className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-ink" style={{ background: tom(lead.cnpj) }}>
            {iniciais(d.nome_fantasia || d.razao_social)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-tight">{nome}</p>
            {d.nome_fantasia && <p className="truncate text-xs text-white/75">{nomeProprio(d.razao_social)}</p>}
            <button type="button" onClick={copiar} className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-white/80 hover:text-white">
              {fmtCnpj(lead.cnpj)} {copiado ? <CheckIcon className="size-3" /> : <Copy className="size-3" />}
            </button>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-full border border-white/40 hover:bg-white/10">
            <X className="size-4" />
          </button>
        </header>

        {/* Etapa */}
        <section>
          <p className="mb-2 text-xs text-white/75">Etapa do funil</p>
          <div className="flex flex-wrap gap-1.5">
            {ETAPAS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => salvar({ etapa: e.id })}
                className={cx(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
                  lead.etapa === e.id ? "bg-white font-medium text-ink" : "bg-white/10 hover:bg-white/20",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: e.cor }} />
                {e.rotulo}
              </button>
            ))}
          </div>
        </section>

        {/* Negócio */}
        <section className="grid grid-cols-2 gap-2">
          <label className="rounded-2xl border border-white/25 bg-white/10 px-3 py-2">
            <span className="block text-[11px] text-white/70">Valor estimado (R$)</span>
            <input
              type="number"
              min={0}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={gravarPendente}
              placeholder="0"
              className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/40"
            />
          </label>
          <label className="rounded-2xl border border-white/25 bg-white/10 px-3 py-2">
            <span className="flex items-center gap-1 text-[11px] text-white/70"><CalendarClock className="size-3" /> Próximo follow-up</span>
            <input
              type="date"
              value={lead.proxima_acao ?? ""}
              onChange={(e) => salvar({ proxima_acao: e.target.value || null })}
              className="w-full bg-transparent text-sm font-medium outline-none [color-scheme:dark]"
            />
          </label>
        </section>

        <label className="block">
          <span className="mb-1.5 block text-xs text-white/75">Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={gravarPendente}
            rows={4}
            placeholder="Com quem falou, o que ficou combinado, objeções…"
            className="w-full resize-none rounded-2xl border border-white/25 bg-white/10 p-3 text-sm outline-none placeholder:text-white/45 focus:border-white/50"
          />
        </label>

        {/* Contato */}
        <section className="flex flex-col gap-1.5 rounded-3xl bg-white/10 p-3 text-sm">
          {fones.map((f) => (
            <a key={f} href={`tel:+55${f}`} className="flex items-center gap-2 tabular-nums hover:underline">
              <Phone className="size-3.5 text-white/70" /> {telefone(f)}
            </a>
          ))}
          {d.email && (
            <a href={`mailto:${d.email}`} className="flex items-center gap-2 hover:underline">
              <Mail className="size-3.5 shrink-0 text-white/70" /> <span className="truncate">{d.email}</span>
            </a>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.endereco ?? ""}, ${d.municipio ?? ""} - ${d.uf}`)}`}
            target="_blank"
            rel="noreferrer"
            className="group flex gap-2 border-t border-white/15 pt-2 hover:underline"
          >
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-white/70" />
            <span className="flex-1">
              {nomeProprio(d.endereco)}
              <br />
              <span className="text-white/75">
                {d.bairro ? `${nomeProprio(d.bairro)} · ` : ""}{d.municipio ? tituloCidade(d.municipio) : ""} - {d.uf} {cep(d.cep)}
              </span>
            </span>
            <ArrowUpRight className="size-3.5 opacity-60" />
          </a>
        </section>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Info rotulo="Segmento" valor={`#${d.cnae_principal ?? "—"}`} sub={d.cnae_descricao} />
          <Info rotulo="Capital social" valor={moeda(d.capital_social)} sub={d.porte != null ? PORTE[d.porte] : null} />
          <Info rotulo="Abertura" valor={data(d.data_abertura)} sub={idade(d.data_abertura) ? `há ${idade(d.data_abertura)}` : null} />
          <Info rotulo="Regime" valor={d.mei ? "MEI" : d.simples ? "Simples" : "Normal"} sub={lead.origem ? `origem: ${lead.origem}` : null} />
        </dl>

        <div className="mt-auto flex flex-col gap-2">
          {celular && (
            <a href={linkWhatsApp(celular)} target="_blank" rel="noreferrer"
              onClick={() => lead.etapa === "novo" && salvar({ etapa: "contato" })}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-lime text-sm font-medium text-ink hover:bg-lime-deep">
              <IconeWhatsApp className="size-5" /> Chamar no WhatsApp
            </a>
          )}
          <div className="flex gap-2">
            <Link href={`/app?q=${lead.cnpj}`} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/40 text-xs hover:bg-white/10">
              <Search className="size-3.5" /> Ver na prospecção
            </Link>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`Remover ${nome} do CRM?`)) return;
                removerLead(lead.cnpj).then(() => avisar("Lead removido do CRM")).catch((e) => avisar(e.message));
                onFechar();
              }}
              className="flex h-10 items-center gap-2 rounded-full border border-white/40 px-4 text-xs hover:bg-white/10"
            >
              <Trash2 className="size-3.5" /> Remover
            </button>
          </div>
          <p className="text-center text-[11px] text-white/65">
            No funil desde {new Date(lead.criado_em).toLocaleDateString("pt-BR")} · atualizado {new Date(lead.atualizado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Info({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string | null }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/25 bg-white/10 px-3 py-2">
      <dt className="text-[11px] text-white/70">{rotulo}</dt>
      <dd className="truncate font-medium">{valor}</dd>
      {sub && <dd className="truncate text-[11px] text-white/80" title={sub}>{sub}</dd>}
    </div>
  );
}

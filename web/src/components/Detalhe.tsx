"use client";

import { ArrowUpRight, Check as CheckIcon, Copy, KanbanSquare, Mail, MapPin, Phone, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type EmpresaDetalhe, urlApi, useApi } from "@/lib/api";
import { type EtapaId, etapa as infoEtapa } from "@/lib/crm";
import { cep, cnpj as fmtCnpj, data, ehCelular, enderecoCurto, idade, iniciais, moeda, nomeProprio, telefone, tom } from "@/lib/formato";
import { tituloCidade } from "./Filtros";
import { IconeWhatsApp, cx } from "./ui";

/** Painel lateral compacto: o foco é a tabela; aqui ficam as ações de contato. */
export function Detalhe({ cnpj, salvo, onSalvar, onFechar, etapaCrm, onCrm, onWhatsApp }: {
  cnpj: string;
  salvo: boolean;
  onSalvar: (e: EmpresaDetalhe) => void;
  onFechar: () => void;
  etapaCrm?: EtapaId;
  onCrm: () => void;
  onWhatsApp: (e: EmpresaDetalhe) => void;
}) {
  const { dados: e } = useApi<EmpresaDetalhe>(urlApi(`empresas/${cnpj}`));
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  if (!e || e.cnpj !== cnpj) return <div className="skeleton-dark h-[520px] rounded-[var(--radius-card)]" />;

  const nome = nomeProprio(e.nome_fantasia || e.razao_social);
  const endereco = enderecoCurto(e);
  const busca = `${endereco}, ${e.bairro ?? ""}, ${e.municipio ?? ""} - ${e.uf}`;
  const fones = [e.telefone1, e.telefone2].filter(Boolean) as string[];
  const celular = fones.find(ehCelular);

  const copiar = async () => {
    await navigator.clipboard.writeText(fmtCnpj(e.cnpj));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-steel p-4 text-white">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-ink" style={{ background: tom(e.cnpj) }}>
          {iniciais(e.nome_fantasia || e.razao_social)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight" title={nome}>{nome}</p>
          {e.nome_fantasia && <p className="truncate text-xs text-white/75">{nomeProprio(e.razao_social)}</p>}
        </div>
        <button type="button" onClick={() => onSalvar(e)} title={salvo ? "Remover dos salvos" : "Salvar"} aria-label={salvo ? "Remover dos salvos" : "Salvar"}
          className={cx("grid size-9 shrink-0 place-items-center rounded-full border transition", salvo ? "border-lime bg-lime text-ink" : "border-white/40 hover:bg-white/10")}>
          <Star className={cx("size-4", salvo && "fill-ink")} />
        </button>
        <button type="button" onClick={onFechar} title="Fechar (Esc)" aria-label="Fechar"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-white/40 hover:bg-white/10">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
        <span className="flex-1 text-sm tabular-nums">{fmtCnpj(e.cnpj)}</span>
        <span className="rounded-full border border-white/40 px-2 py-0.5 text-[11px]">{e.situacao_descricao}</span>
        <button type="button" onClick={copiar} title="Copiar CNPJ" aria-label="Copiar CNPJ" className="grid size-7 place-items-center rounded-full hover:bg-white/15">
          {copiado ? <CheckIcon className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Info rotulo="Capital social" valor={moeda(e.capital_social)} sub={e.porte_descricao} />
        <Info rotulo="Abertura" valor={data(e.data_abertura)} sub={idade(e.data_abertura) ? `há ${idade(e.data_abertura)}` : null} />
        <Info rotulo="Regime" valor={e.mei ? "MEI" : e.simples ? "Simples" : "Normal"} sub={e.matriz ? "Matriz" : "Filial"} />
        <Info rotulo="Segmento" valor={`#${e.cnae_principal}`} sub={e.cnae_descricao} />
      </dl>

      <div className="flex flex-col gap-1.5 rounded-2xl bg-white/10 p-3 text-sm">
        {fones.map((f) => (
          <a key={f} href={`tel:+55${f}`} className="flex items-center gap-2 tabular-nums hover:underline">
            <Phone className="size-3.5 text-white/70" /> {telefone(f)}
            {ehCelular(f) && <span className="rounded-full bg-lime px-1.5 text-[10px] text-ink">WhatsApp</span>}
          </a>
        ))}
        {e.email && (
          <a href={`mailto:${e.email}`} className="flex items-center gap-2 hover:underline">
            <Mail className="size-3.5 shrink-0 text-white/70" /> <span className="truncate">{e.email}</span>
          </a>
        )}
        {!fones.length && !e.email && <p className="text-white/70">Sem telefone ou e-mail na base.</p>}
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}`} target="_blank" rel="noreferrer"
          className="group mt-1 flex gap-2 border-t border-white/15 pt-2 hover:underline">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-white/70" />
          <span className="flex-1">
            {endereco}{e.complemento ? ` · ${nomeProprio(e.complemento)}` : ""}<br />
            <span className="text-white/75">
              {e.bairro ? `${nomeProprio(e.bairro)} · ` : ""}{e.municipio ? tituloCidade(e.municipio) : ""} - {e.uf} {cep(e.cep)}
            </span>
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
        </a>
      </div>

      {e.cnaes_secundarios_detalhe.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-white/75">Atividades secundárias ({e.cnaes_secundarios_detalhe.length})</p>
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            {e.cnaes_secundarios_detalhe.map((c) => (
              <span key={c.codigo} title={c.descricao} className="max-w-full truncate rounded-full bg-white/15 px-2.5 py-0.5 text-[11px]">
                {c.descricao}
              </span>
            ))}
          </div>
        </div>
      )}

      {etapaCrm ? (
        <Link href="/crm" className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm text-white hover:bg-coal-2">
          <span className="size-2 rounded-full" style={{ background: infoEtapa(etapaCrm).cor }} />
          No CRM em “{infoEtapa(etapaCrm).rotulo}” · abrir funil
        </Link>
      ) : (
        <button type="button" onClick={onCrm} className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm text-white hover:bg-coal-2">
          <KanbanSquare className="size-4 text-lime" /> Adicionar ao CRM
        </button>
      )}

      {celular ? (
        <button type="button" onClick={() => onWhatsApp(e)}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-lime text-sm font-medium text-ink hover:bg-lime-deep">
          <IconeWhatsApp className="size-5" /> Chamar no WhatsApp
        </button>
      ) : fones[0] ? (
        <Cta href={`tel:+55${fones[0]}`} icone={<Phone className="size-4" />}>Ligar agora</Cta>
      ) : e.email ? (
        <Cta href={`mailto:${e.email}`} icone={<Mail className="size-4" />}>Enviar e-mail</Cta>
      ) : null}
      <p className="text-center text-[11px] text-white/65">Fonte: Receita Federal · base {e.mes_referencia}</p>
    </article>
  );
}

function Info({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string | null }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/25 bg-white/10 px-3 py-2">
      <dt className="text-[11px] text-white/70">{rotulo}</dt>
      <dd className="truncate text-sm font-medium">{valor}</dd>
      {sub && <dd className="truncate text-[11px] text-white/80" title={sub}>{sub}</dd>}
    </div>
  );
}

function Cta({ href, icone, children }: { href: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
      className="flex h-11 items-center justify-center gap-2 rounded-full bg-lime text-sm font-medium text-ink hover:bg-lime-deep">
      {icone} {children}
    </a>
  );
}

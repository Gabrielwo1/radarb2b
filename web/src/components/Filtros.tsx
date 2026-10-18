"use client";

import {
  BadgeCheck, Building2, CalendarRange, ChevronDown, Landmark, MapPin, Map as MapIcon, Phone, Search, Shapes,
  SlidersHorizontal, X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { type Cnae, type Municipio, urlApi, useApi, useDebounce } from "@/lib/api";
import { PORTES, UF_PADRAO, contarFiltros, dataRelativa, lista } from "@/lib/filtros";
import { useLocal } from "@/lib/local";
import { escala, numero } from "@/lib/formato";
import { Check, Contador, Switch, cx } from "./ui";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

type Definir = (mudancas: Record<string, string | null>) => void;
type Props = { sp: URLSearchParams; definir: Definir; ufsCarregadas: string[] };

const SECOES = ["uf", "cidades", "cnae", "porte", "abertura", "contato", "regime", "capital"] as const;
type Secao = (typeof SECOES)[number];

/**
 * Barra compacta (botão Filtros + busca + chips ativos) e um painel único que abre/recolhe.
 * Dentro do painel, cada filtro tem seu card delimitado que expande/recolhe individualmente.
 */
/** Tab preta encaixada abaixo do chat: texto + botão redondo que abre/recolhe os filtros detalhados. */
export function TabFiltros({ aberto, ativos, onClick }: { aberto: boolean; ativos: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      className="group flex items-center gap-3 rounded-full bg-ink p-1.5 pl-5 text-left text-sm text-white/75 shadow-[0_12px_30px_-14px_rgb(20_21_24/0.6)] transition hover:text-white"
    >
      <SlidersHorizontal className="size-4 shrink-0 text-lime" />
      <span>
        Prefere ser mais específico? Use os <span className="font-medium text-white">filtros detalhados</span>
        {ativos > 0 && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-xs text-white">{ativos} ativo{ativos > 1 ? "s" : ""}</span>}
      </span>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-ink transition group-hover:bg-lime-deep">
        <ChevronDown className={cx("size-4 transition-transform", aberto && "rotate-180")} />
      </span>
    </button>
  );
}

export function Filtros({ sp, definir, ufsCarregadas, aberto, onFechar }: Props & { aberto: boolean; onFechar: () => void }) {
  const [recolhidas, setRecolhidas] = useLocal<Secao[]>("radar:filtros-recolhidos", []);
  const ativos = contarFiltros(sp);
  const uf = sp.get("uf") ?? UF_PADRAO;

  const { dados: municipios } = useApi<Municipio[]>(urlApi("municipios", new URLSearchParams({ uf })));
  const cnaesSel = lista(sp.get("cnae"));
  const { dados: nomesCnae } = useApi<Cnae[]>(
    cnaesSel.length ? urlApi("cnaes", new URLSearchParams({ codigos: cnaesSel.join(",") })) : null,
  );

  const alternarSecao = (s: Secao) =>
    setRecolhidas((r) => (r.includes(s) ? r.filter((x) => x !== s) : [...r, s]));
  const tudoRecolhido = recolhidas.length === SECOES.length;

  const alternarValor = (chave: string, valor: string) => {
    const atual = lista(sp.get(chave));
    const novo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
    definir({ [chave]: novo.join(",") || null });
  };

  const chips = montarChips(sp, municipios, nomesCnae, alternarValor, definir);
  if (!aberto && chips.length === 0) return null;

  return (
    <div className="glass relative z-30 rounded-[28px] p-2.5">
      {/* Filtros ativos como chips removíveis */}
      {(chips.length > 0 || aberto) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="mr-1 flex items-center gap-1.5 text-sm font-medium">
            <SlidersHorizontal className="size-4" /> Filtros ativos <Contador n={ativos} />
          </span>
          {chips.map((c) => (
            <span key={c.id} className="flex h-8 items-center gap-1 rounded-full bg-lime pl-3 pr-1 text-xs font-medium">
              <span className="max-w-[220px] truncate" title={c.rotulo}>{c.rotulo}</span>
              <button type="button" onClick={c.remover} aria-label={`Remover ${c.rotulo}`}
                className="grid size-6 place-items-center rounded-full hover:bg-ink/10">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1">
            {ativos > 0 && (
              <button
                type="button"
                onClick={() => definir(Object.fromEntries([...sp.keys()].filter((k) => k !== "aba" && k !== "ordem").map((k) => [k, null])))}
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-ink/60 hover:bg-white hover:text-ink"
              >
                <X className="size-3.5" /> Limpar tudo
              </button>
            )}
            {aberto && (
              <button type="button" onClick={onFechar} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs text-ink/60 hover:bg-white hover:text-ink">
                Recolher painel <ChevronDown className="size-3.5 rotate-180" />
              </button>
            )}
          </span>
        </div>
      )}

      {/* Painel único: abre e recolhe com animação de altura */}
      <div className={cx("grid transition-[grid-template-rows] duration-300 ease-out", aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="mt-3 border-t border-ink/5 pt-3">
            <div className="mb-3 flex items-center justify-between px-1 text-xs text-muted">
              <span>Clique no título de cada filtro para expandir ou recolher</span>
              <button type="button" className="rounded-full px-3 py-1.5 hover:bg-white/70 hover:text-ink"
                onClick={() => setRecolhidas(() => (tudoRecolhido ? [] : [...SECOES]))}>
                {tudoRecolhido ? "Expandir todos" : "Recolher todos"}
              </button>
            </div>

            <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Card id="uf" titulo="Estado" icone={<MapIcon className="size-4" />} resumo={uf}
                ativo={uf !== UF_PADRAO} recolhido={recolhidas.includes("uf")} onAlternar={alternarSecao}
                onLimpar={() => definir({ uf: null, municipio: null })}>
                <div className="grid grid-cols-6 gap-1">
                  {UFS.map((u) => {
                    const disponivel = ufsCarregadas.length === 0 || ufsCarregadas.includes(u);
                    return (
                      <button key={u} type="button" disabled={!disponivel}
                        onClick={() => definir({ uf: u === UF_PADRAO ? null : u, municipio: null })}
                        title={disponivel ? u : `${u} ainda não carregada`}
                        className={cx("h-8 rounded-full text-xs transition",
                          u === uf ? "bg-ink text-lime" : disponivel ? "bg-white/80 hover:bg-white" : "hatch-dark cursor-not-allowed text-ink/25")}>
                        {u}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card id="cidades" titulo="Cidades" icone={<MapPin className="size-4" />}
                resumo={resumoLista(lista(sp.get("municipio")).length, "todas", "cidade", "cidades")}
                ativo={!!sp.get("municipio")} recolhido={recolhidas.includes("cidades")} onAlternar={alternarSecao}
                onLimpar={() => definir({ municipio: null })}>
                <ListaCidades municipios={municipios} selecionadas={lista(sp.get("municipio"))} alternar={(c) => alternarValor("municipio", c)} />
              </Card>

              <Card id="cnae" titulo="Segmento (CNAE)" icone={<Shapes className="size-4" />}
                resumo={resumoLista(cnaesSel.length, "todos", "segmento", "segmentos")}
                ativo={cnaesSel.length > 0} recolhido={recolhidas.includes("cnae")} onAlternar={alternarSecao}
                onLimpar={() => definir({ cnae: null, cnae_secundario: null })}>
                <ListaCnaes selecionados={cnaesSel} alternar={(c) => alternarValor("cnae", c)} />
                <div className="mt-2 border-t border-ink/5 pt-1">
                  <Switch ligado={sp.get("cnae_secundario") === "true"}
                    onChange={() => definir({ cnae_secundario: sp.get("cnae_secundario") ? null : "true" })}>
                    Incluir atividades secundárias
                  </Switch>
                </div>
              </Card>

              <Card id="porte" titulo="Porte" icone={<Building2 className="size-4" />}
                resumo={lista(sp.get("porte")).length ? PORTES.filter((p) => lista(sp.get("porte")).includes(p.valor)).map((p) => p.curto).join(" + ") : "todos"}
                ativo={!!sp.get("porte")} recolhido={recolhidas.includes("porte")} onAlternar={alternarSecao}
                onLimpar={() => definir({ porte: null })}>
                {PORTES.map((p) => (
                  <Check key={p.valor} marcado={lista(sp.get("porte")).includes(p.valor)} extra={p.curto}
                    onChange={() => alternarValor("porte", p.valor)}>
                    {p.rotulo}
                  </Check>
                ))}
              </Card>

              <Card id="abertura" titulo="Data de abertura" icone={<CalendarRange className="size-4" />}
                resumo={sp.get("abertura_de") || sp.get("abertura_ate") ? periodo(sp.get("abertura_de"), sp.get("abertura_ate")) : "qualquer data"}
                ativo={!!(sp.get("abertura_de") || sp.get("abertura_ate"))} recolhido={recolhidas.includes("abertura")}
                onAlternar={alternarSecao} onLimpar={() => definir({ abertura_de: null, abertura_ate: null })}>
                <Abertura de={sp.get("abertura_de")} ate={sp.get("abertura_ate")} definir={definir} />
              </Card>

              <Card id="contato" titulo="Contato" icone={<Phone className="size-4" />}
                resumo={[sp.get("com_telefone") && "telefone", sp.get("com_email") && "e-mail"].filter(Boolean).join(" + ") || "qualquer"}
                ativo={!!(sp.get("com_telefone") || sp.get("com_email"))} recolhido={recolhidas.includes("contato")}
                onAlternar={alternarSecao} onLimpar={() => definir({ com_telefone: null, com_email: null })}>
                <Toggle sp={sp} definir={definir} chave="com_telefone">Tem telefone</Toggle>
                <Toggle sp={sp} definir={definir} chave="com_email">Tem e-mail</Toggle>
              </Card>

              <Card id="regime" titulo="Regime e tipo" icone={<BadgeCheck className="size-4" />}
                resumo={[sp.get("simples") && "Simples", sp.get("mei") && "MEI", sp.get("matriz") && "matriz"].filter(Boolean).join(" + ") || "todos"}
                ativo={!!(sp.get("simples") || sp.get("mei") || sp.get("matriz"))} recolhido={recolhidas.includes("regime")}
                onAlternar={alternarSecao} onLimpar={() => definir({ simples: null, mei: null, matriz: null })}>
                <Toggle sp={sp} definir={definir} chave="simples">Optante do Simples</Toggle>
                <Toggle sp={sp} definir={definir} chave="mei">MEI</Toggle>
                <Toggle sp={sp} definir={definir} chave="matriz">Somente matriz</Toggle>
              </Card>

              <Card id="capital" titulo="Capital e bairro" icone={<Landmark className="size-4" />}
                resumo={[sp.get("capital_min") && `≥ R$ ${numero(Number(sp.get("capital_min")))}`, sp.get("bairro")].filter(Boolean).join(" · ") || "sem restrição"}
                ativo={!!(sp.get("capital_min") || sp.get("bairro"))} recolhido={recolhidas.includes("capital")}
                onAlternar={alternarSecao} onLimpar={() => definir({ capital_min: null, bairro: null })}>
                <div className="grid gap-2 px-1">
                  <CampoTexto rotulo="Capital social mínimo (R$)" valor={sp.get("capital_min") ?? ""} tipo="number"
                    onConfirmar={(v) => definir({ capital_min: v || null })} />
                  <CampoTexto rotulo="Bairro contém" valor={sp.get("bairro") ?? ""}
                    onConfirmar={(v) => definir({ bairro: v || null })} />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card de filtro: cabeçalho fixo (título, resumo, limpar, recolher) e corpo com altura limitada. */
function Card({ id, titulo, icone, resumo, ativo, recolhido, onAlternar, onLimpar, children }: {
  id: Secao;
  titulo: string;
  icone: ReactNode;
  resumo: string;
  ativo: boolean;
  recolhido: boolean;
  onAlternar: (s: Secao) => void;
  onLimpar: () => void;
  children: ReactNode;
}) {
  return (
    <section className={cx("rounded-3xl border bg-white/60 transition-colors", ativo ? "border-ink/15" : "border-white/90")}>
      <div className="flex items-center gap-2 p-2 pl-3">
        <button type="button" onClick={() => onAlternar(id)} aria-expanded={!recolhido}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className={cx("grid size-8 shrink-0 place-items-center rounded-full", ativo ? "bg-lime" : "bg-mist")}>{icone}</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{titulo}</span>
            <span className={cx("block truncate text-xs", ativo ? "text-ink/70" : "text-muted")}>{resumo}</span>
          </span>
        </button>
        {ativo && (
          <button type="button" onClick={onLimpar} className="rounded-full px-2 py-1 text-xs text-ink/50 hover:bg-white hover:text-ink">
            Limpar
          </button>
        )}
        <button type="button" onClick={() => onAlternar(id)} aria-label={recolhido ? `Expandir ${titulo}` : `Recolher ${titulo}`}
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white">
          <ChevronDown className={cx("size-4 transition", !recolhido && "rotate-180")} />
        </button>
      </div>
      <div className={cx("grid transition-[grid-template-rows] duration-200", recolhido ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
        <div className="overflow-hidden">
          <div className="px-2 pb-2">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ListaCidades({ municipios, selecionadas, alternar }: {
  municipios: Municipio[] | null;
  selecionadas: string[];
  alternar: (codigo: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = semAcento(busca);
  const filtradas = (municipios ?? [])
    .filter((m) => semAcento(m.nome).includes(termo))
    .sort((a, b) => Number(selecionadas.includes(String(b.codigo))) - Number(selecionadas.includes(String(a.codigo))) || b.total - a.total)
    .slice(0, 80);
  return (
    <>
      <CaixaBusca valor={busca} onChange={setBusca} placeholder="Buscar cidade" />
      <div className="scroll-thin mt-1.5 h-48 overflow-y-auto">
        {filtradas.map((m) => (
          <Check key={m.codigo} marcado={selecionadas.includes(String(m.codigo))} onChange={() => alternar(String(m.codigo))} extra={escala(m.total)}>
            {tituloCidade(m.nome)}
          </Check>
        ))}
        {municipios && !filtradas.length && <p className="px-3 py-4 text-sm text-muted">Nenhuma cidade encontrada.</p>}
        {!municipios && <div className="skeleton m-1 h-40 rounded-2xl" />}
      </div>
    </>
  );
}

function ListaCnaes({ selecionados, alternar }: { selecionados: string[]; alternar: (codigo: string) => void }) {
  const [busca, setBusca] = useState("");
  const termo = useDebounce(busca, 250);
  const { dados, carregando } = useApi<Cnae[]>(urlApi("cnaes", new URLSearchParams({ q: termo, limit: "40" })));
  return (
    <>
      <CaixaBusca valor={busca} onChange={setBusca} placeholder="Ex.: padaria, software, 4721…" carregando={carregando} />
      <div className="scroll-thin mt-1.5 h-48 overflow-y-auto">
        {(dados ?? []).map((c) => (
          <Check key={c.codigo} marcado={selecionados.includes(String(c.codigo))} onChange={() => alternar(String(c.codigo))} extra={c.codigo}>
            <span className="line-clamp-2 whitespace-normal">{c.descricao}</span>
          </Check>
        ))}
      </div>
    </>
  );
}

const PRESETS = [
  { rotulo: "3 meses", meses: 3 },
  { rotulo: "6 meses", meses: 6 },
  { rotulo: "1 ano", meses: 12 },
  { rotulo: "2 anos", meses: 24 },
];

function Abertura({ de, ate, definir }: { de: string | null; ate: string | null; definir: Definir }) {
  return (
    <div className="px-1">
      <p className="mb-1.5 text-xs text-muted">Abertas nos últimos</p>
      <div className="grid grid-cols-4 gap-1">
        {PRESETS.map((p) => {
          const valor = dataRelativa(p.meses);
          return (
            <button key={p.meses} type="button" onClick={() => definir({ abertura_de: valor, abertura_ate: null })}
              className={cx("h-8 rounded-full text-xs transition", de === valor && !ate ? "bg-ink text-lime" : "bg-white/80 hover:bg-white")}>
              {p.rotulo}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => definir({ abertura_de: null, abertura_ate: dataRelativa(120) })}
        className="mt-1 h-8 w-full rounded-full bg-white/80 text-xs hover:bg-white">
        Consolidadas (mais de 10 anos)
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">De
          <input type="date" value={de ?? ""} onChange={(e) => definir({ abertura_de: e.target.value || null })}
            className="mt-1 h-9 w-full rounded-full border border-white bg-white/80 px-3 text-xs text-ink" />
        </label>
        <label className="text-xs text-muted">Até
          <input type="date" value={ate ?? ""} onChange={(e) => definir({ abertura_ate: e.target.value || null })}
            className="mt-1 h-9 w-full rounded-full border border-white bg-white/80 px-3 text-xs text-ink" />
        </label>
      </div>
    </div>
  );
}

function Toggle({ sp, definir, chave, children }: { sp: URLSearchParams; definir: Definir; chave: string; children: ReactNode }) {
  return (
    <Switch ligado={sp.get(chave) === "true"} onChange={() => definir({ [chave]: sp.get(chave) ? null : "true" })}>
      {children}
    </Switch>
  );
}

function CaixaBusca({ valor, onChange, placeholder, carregando }: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  carregando?: boolean;
}) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-full border border-white bg-white/80 px-3">
      <Search className={cx("size-3.5 text-muted", carregando && "animate-pulse")} />
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" />
    </div>
  );
}

function CampoTexto({ rotulo, valor, onConfirmar, tipo = "text" }: {
  rotulo: string;
  valor: string;
  onConfirmar: (v: string) => void;
  tipo?: string;
}) {
  return (
    <label className="text-xs text-muted">
      {rotulo}
      <input type={tipo} key={valor} defaultValue={valor}
        onBlur={(e) => e.target.value.trim() !== valor && onConfirmar(e.target.value.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="mt-1 h-9 w-full rounded-full border border-white bg-white/80 px-3 text-sm text-ink outline-none" />
    </label>
  );
}

// ---------------------------------------------------------------------------

type Chip = { id: string; rotulo: string; remover: () => void };

function montarChips(
  sp: URLSearchParams,
  municipios: Municipio[] | null,
  cnaes: Cnae[] | null,
  alternarValor: (chave: string, valor: string) => void,
  definir: Definir,
): Chip[] {
  const chips: Chip[] = [];
  const uf = sp.get("uf");
  if (uf && uf !== UF_PADRAO) chips.push({ id: "uf", rotulo: `UF: ${uf}`, remover: () => definir({ uf: null, municipio: null }) });
  for (const c of lista(sp.get("municipio"))) {
    const m = municipios?.find((x) => String(x.codigo) === c);
    chips.push({ id: `m${c}`, rotulo: m ? tituloCidade(m.nome) : `Cidade ${c}`, remover: () => alternarValor("municipio", c) });
  }
  for (const c of lista(sp.get("cnae"))) {
    const n = cnaes?.find((x) => String(x.codigo) === c);
    chips.push({ id: `c${c}`, rotulo: n ? n.descricao : `CNAE ${c}`, remover: () => alternarValor("cnae", c) });
  }
  if (sp.get("cnae_secundario")) chips.push({ id: "sec", rotulo: "Inclui secundárias", remover: () => definir({ cnae_secundario: null }) });
  for (const p of lista(sp.get("porte"))) {
    const porte = PORTES.find((x) => x.valor === p);
    chips.push({ id: `p${p}`, rotulo: porte?.rotulo ?? p, remover: () => alternarValor("porte", p) });
  }
  if (sp.get("abertura_de") || sp.get("abertura_ate"))
    chips.push({ id: "ab", rotulo: `Abertura: ${periodo(sp.get("abertura_de"), sp.get("abertura_ate"))}`, remover: () => definir({ abertura_de: null, abertura_ate: null }) });
  const toggles: [string, string][] = [["com_telefone", "Com telefone"], ["com_email", "Com e-mail"], ["simples", "Simples"], ["mei", "MEI"], ["matriz", "Somente matriz"]];
  for (const [k, r] of toggles) if (sp.get(k)) chips.push({ id: k, rotulo: r, remover: () => definir({ [k]: null }) });
  if (sp.get("capital_min")) chips.push({ id: "cap", rotulo: `Capital ≥ R$ ${numero(Number(sp.get("capital_min")))}`, remover: () => definir({ capital_min: null }) });
  if (sp.get("bairro")) chips.push({ id: "bai", rotulo: `Bairro: ${sp.get("bairro")}`, remover: () => definir({ bairro: null }) });
  if (sp.get("q")) chips.push({ id: "q", rotulo: `"${sp.get("q")}"`, remover: () => definir({ q: null }) });
  return chips;
}

const dataBr = (v: string) => v.split("-").reverse().join("/");
const periodo = (de: string | null, ate: string | null) => `${de ? dataBr(de) : "início"} → ${ate ? dataBr(ate) : "hoje"}`;
const resumoLista = (n: number, vazio: string, um: string, varios: string) => (n === 0 ? vazio : `${n} ${n === 1 ? um : varios}`);
const semAcento = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function tituloCidade(nome: string) {
  return nome
    .toLowerCase()
    .split(" ")
    .map((p) => (["de", "do", "da", "dos", "das"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

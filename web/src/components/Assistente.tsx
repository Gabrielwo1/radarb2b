"use client";

import { ArrowDown, ArrowUp, Loader2, MapPin, Shapes, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { escala } from "@/lib/formato";
import { exigirLogin } from "@/lib/sessao";
import { tituloCidade } from "./Filtros";
import { cx } from "./ui";

export type Interpretacao = {
  filtros: Record<string, string>;
  resposta: string;
  motor: "openai" | "claude" | "local";
  mantidos?: string[];
  entendido: { uf: string; cidades: string[]; segmentos: { codigo: number; descricao: string }[]; naoEncontradas: string[] };
};

type Troca = { id: number; pergunta: string; resultado?: Interpretacao; erro?: string };

// Conversa compartilhada: a mesma no chat do topo e no chat lateral (ao lado da tabela, no desktop)
let conversa: { trocas: Troca[]; enviando: boolean } = { trocas: [], enviando: false };
const ouvintes = new Set<() => void>();
const mudar = (p: Partial<typeof conversa>) => {
  conversa = { ...conversa, ...p };
  ouvintes.forEach((f) => f());
};
const VAZIA = { trocas: [] as Troca[], enviando: false };
export const useConversa = () =>
  useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => conversa, () => VAZIA);
export const limparConversa = () => mudar({ trocas: [], enviando: false });

type Props = {
  uf: string;
  total: number | null;
  /** Filtros que já estão na tela: a próxima mensagem refina esta busca */
  atuais: Record<string, string>;
  onAplicar: (filtros: Record<string, string>, pergunta: string) => void;
  /** Rola até a tabela de resultados */
  onVerResultados: () => void;
};

async function perguntar(pergunta: string, { uf, atuais, onAplicar }: Pick<Props, "uf" | "atuais" | "onAplicar">) {
  const id = Date.now();
  mudar({ trocas: [...conversa.trocas.slice(-5), { id, pergunta }], enviando: true });
  const atualizar = (x: Partial<Troca>) => mudar({ trocas: conversa.trocas.map((t) => (t.id === id ? { ...t, ...x } : t)) });
  try {
    const r = await fetch("/api/interpretar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texto: pergunta, uf, anterior: atuais }),
    });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro ?? "Não foi possível interpretar");
    atualizar({ resultado: dados });
    onAplicar(dados.filtros, pergunta);
  } catch (e) {
    atualizar({ erro: (e as Error).message });
  } finally {
    mudar({ enviando: false });
  }
}

/** Busca conversacional: o texto vira filtros (aplicados na URL) e a resposta mostra o que foi entendido. */
export function Assistente({ abaixo, inicial, ...props }: Props & {
  /** Busca vinda de um link (ex.: e-mail com /app?busca=...): roda uma vez ao abrir */
  inicial?: string | null;
  /** Conteúdo encaixado logo abaixo da caixa (ex.: tab de filtros detalhados) */
  abaixo?: React.ReactNode;
}) {
  const { trocas } = useConversa();
  const rodouInicial = useRef(false);
  useEffect(() => {
    if (!inicial || rodouInicial.current) return;
    rodouInicial.current = true;
    exigirLogin(() => perguntar(inicial, props), "Crie sua conta grátis para buscar empresas");
  }, [inicial]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 pt-4 text-center">
      {trocas.length === 0 && (
        <>
          <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs text-lime">
            <Sparkles className="size-3.5" /> Busca inteligente
          </span>
          <h1 className="text-4xl tracking-tight sm:text-5xl">
            Que tipo de empresa você quer <span className="relative whitespace-nowrap">encontrar hoje?<span className="bar-lime absolute inset-x-0 -bottom-1 -z-10 h-3 rounded-full opacity-70" /></span>
          </h1>
          <p className="max-w-xl text-sm text-ink/60">
            Descreva o segmento, a região e o que importa para você, ou cole um CNPJ. Eu transformo isso nos filtros e mostro as empresas no mapa e na tabela.
          </p>
        </>
      )}
      {trocas.length > 0 && <Mensagens {...props} />}
      <Caixa {...props} />
      {abaixo}
    </section>
  );
}

/** Chat lateral (desktop): acompanha a tabela quando a pessoa rola a página. */
export function AssistenteLateral(props: Props) {
  const { trocas } = useConversa();
  const lista = useRef<HTMLDivElement>(null);
  // Rola só a lista de mensagens (scrollIntoView rolaria a página inteira)
  useEffect(() => { lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" }); }, [trocas]);
  return (
    <aside className="glass flex max-h-[calc(100dvh-2.5rem)] flex-col rounded-[var(--radius-card)] p-3">
      <p className="flex items-center gap-2 px-2 pb-2 pt-1 text-sm font-medium">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-lime"><Sparkles className="size-3.5" /></span>
        Refine com a IA
      </p>
      <div ref={lista} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1 text-left">
        {trocas.length ? <Mensagens {...props} compacto /> : (
          <p className="px-2 py-3 text-sm text-ink/55">Peça ajustes sem sair da tabela: “só as com WhatsApp”, “abertas no último ano”, “agora em Cascavel”.</p>
        )}
      </div>
      <Caixa {...props} compacto />
    </aside>
  );
}

function Mensagens({ total, onVerResultados, compacto }: Props & { compacto?: boolean }) {
  const { trocas } = useConversa();
  const ultima = trocas.at(-1);
  const visiveis = compacto ? trocas : trocas.slice(-3);
  return (
    <div className="flex w-full flex-col gap-3 text-left">
      {visiveis.map((t) => (
        <div key={t.id} className="flex flex-col gap-2">
          <p className={cx("ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-white", compacto ? "text-[13px]" : "text-sm")}>{t.pergunta}</p>
          <div className={cx("mr-auto max-w-[94%] rounded-3xl rounded-bl-lg px-4 py-3", compacto ? "bg-white/80 text-[13px]" : "glass text-sm")}>
            {!t.resultado && !t.erro && (
              <span className="flex items-center gap-2 text-ink/60"><Loader2 className="size-4 animate-spin" /> Entendendo o que você procura…</span>
            )}
            {t.erro && <span className="text-[#b4232a]">{t.erro}</span>}
            {t.resultado && (
              <>
                <p>{t.resultado.resposta}</p>
                <Entendido r={t.resultado} />
                {t === ultima && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink/60">
                      <strong className="text-ink">{total == null ? "…" : escala(total)}</strong> empresas encontradas
                    </span>
                    <button type="button" onClick={onVerResultados}
                      className="ml-auto flex h-9 items-center gap-1.5 rounded-full bg-ink pl-3.5 pr-1 text-xs font-medium text-white transition hover:bg-coal-2">
                      Ver resultados
                      <span className="grid size-7 place-items-center rounded-full bg-lime text-ink"><ArrowDown className="size-3.5" /></span>
                    </button>
                  </div>
                )}
                {t.resultado.motor === "local" && !compacto && (
                  <p className="mt-1.5 text-[11px] text-muted">Modo básico (sem IA configurada).</p>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Caixa({ compacto, ...props }: Props & { compacto?: boolean }) {
  const { enviando } = useConversa();
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  const enviar = () => {
    const pergunta = texto.trim();
    if (!pergunta || enviando) return;
    exigirLogin(() => {
      setTexto("");
      perguntar(pergunta, props).finally(() => campo.current?.focus());
    }, "Crie sua conta grátis para buscar empresas");
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); enviar(); }}
      onClick={(e) => e.target === e.currentTarget && campo.current?.focus()}
      className={cx("flex w-full cursor-text flex-col text-left focus-within:ring-2 focus-within:ring-ink/10",
        compacto ? "mt-2 rounded-3xl bg-white p-1.5" : "glass rounded-[28px] p-2")}
    >
      <textarea
        ref={campo}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, compacto ? 120 : 160)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
        }}
        rows={compacto ? 1 : 2}
        placeholder={compacto ? "Refinar: “só com WhatsApp”…" : "Escreva aqui o tipo de empresa que procura, a região e outros detalhes… ex.: padarias em Curitiba abertas no último ano com WhatsApp"}
        className={cx("w-full resize-none bg-transparent px-3 pt-2 outline-none placeholder:text-ink/35", compacto ? "min-h-[40px] text-sm" : "max-h-40 min-h-[56px] text-[15px]")}
      />
      <div className="flex items-center gap-2 pl-3">
        {!compacto && <span className="hidden text-[11px] text-muted sm:block">Enter para buscar · Shift+Enter quebra linha · a próxima mensagem refina a busca</span>}
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          aria-label="Buscar"
          className={cx("ml-auto grid shrink-0 place-items-center rounded-full bg-lime text-ink transition hover:bg-lime-deep disabled:bg-ink/10 disabled:text-ink/30", compacto ? "size-9" : "size-11")}
        >
          {enviando ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </div>
    </form>
  );
}

function Entendido({ r }: { r: Interpretacao }) {
  const { segmentos, cidades, naoEncontradas } = r.entendido;
  if (!segmentos.length && !cidades.length && !naoEncontradas.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {segmentos.map((s) => (
        <span key={s.codigo} title={`CNAE ${s.codigo} · ${s.descricao}`} className="flex max-w-[280px] items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-xs">
          <Shapes className="size-3 shrink-0" /> <span className="truncate">{s.descricao}</span>
        </span>
      ))}
      {cidades.map((c) => (
        <span key={c} className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs text-white">
          <MapPin className="size-3" /> {tituloCidade(c)}
        </span>
      ))}
      {naoEncontradas.map((c) => (
        <span key={c} className={cx("hatch-dark rounded-full border border-ink/10 px-2.5 py-1 text-xs text-ink/50")} title="Cidade não encontrada nesta UF">
          {c}?
        </span>
      ))}
    </div>
  );
}

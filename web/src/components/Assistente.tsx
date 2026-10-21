"use client";

import { ArrowUp, Loader2, MapPin, Shapes, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { escala } from "@/lib/formato";
import { exigirLogin } from "@/lib/sessao";
import { tituloCidade } from "./Filtros";
import { cx } from "./ui";

type Interpretacao = {
  filtros: Record<string, string>;
  resposta: string;
  motor: "openai" | "claude" | "local";
  entendido: { uf: string; cidades: string[]; segmentos: { codigo: number; descricao: string }[]; naoEncontradas: string[] };
};

type Troca = { id: number; pergunta: string; resultado?: Interpretacao; erro?: string };


/** Busca conversacional: o texto vira filtros (aplicados na URL) e a resposta mostra o que foi entendido. */
export function Assistente({ uf, total, onAplicar, abaixo }: {
  uf: string;
  total: number | null;
  onAplicar: (filtros: Record<string, string>, pergunta: string) => void;
  /** Conteúdo encaixado logo abaixo da caixa (ex.: tab de filtros detalhados) */
  abaixo?: React.ReactNode;
}) {
  const [texto, setTexto] = useState("");
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  const enviar = (pergunta: string) => {
    if (!pergunta.trim() || enviando) return;
    exigirLogin(() => buscar(pergunta), "Crie sua conta grátis para buscar empresas");
  };

  const buscar = async (pergunta: string) => {
    const id = Date.now();
    setTrocas((t) => [...t.slice(-2), { id, pergunta }]);
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch("/api/interpretar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: pergunta, uf }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Não foi possível interpretar");
      setTrocas((t) => t.map((x) => (x.id === id ? { ...x, resultado: dados } : x)));
      onAplicar(dados.filtros, pergunta);
    } catch (e) {
      setTrocas((t) => t.map((x) => (x.id === id ? { ...x, erro: (e as Error).message } : x)));
    } finally {
      setEnviando(false);
      campo.current?.focus();
    }
  };

  const ultima = trocas.at(-1);

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

      {trocas.length > 0 && (
        <div className="flex w-full flex-col gap-3 text-left">
          {trocas.map((t) => (
            <div key={t.id} className="flex flex-col gap-2">
              <p className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-sm text-white">{t.pergunta}</p>
              <div className="glass mr-auto max-w-[90%] rounded-3xl rounded-bl-lg px-4 py-3 text-sm">
                {!t.resultado && !t.erro && (
                  <span className="flex items-center gap-2 text-ink/60"><Loader2 className="size-4 animate-spin" /> Entendendo o que você procura…</span>
                )}
                {t.erro && <span className="text-[#b4232a]">{t.erro}</span>}
                {t.resultado && (
                  <>
                    <p>{t.resultado.resposta}</p>
                    <Entendido r={t.resultado} />
                    {t === ultima && (
                      <p className="mt-2 text-xs text-ink/60">
                        → <strong className="text-ink">{total == null ? "…" : escala(total)}</strong> empresas encontradas. Ajuste nos filtros abaixo ou refine aqui.
                      </p>
                    )}
                    {t.resultado.motor === "local" && (
                      <p className="mt-1.5 text-[11px] text-muted">Modo básico (sem IA configurada).</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(texto); }}
        onClick={(e) => e.target === e.currentTarget && campo.current?.focus()}
        className="glass flex w-full cursor-text flex-col rounded-[28px] p-2 text-left focus-within:ring-2 focus-within:ring-ink/10"
      >
        <textarea
          ref={campo}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); }
          }}
          rows={2}
          placeholder="Escreva aqui o tipo de empresa que procura, a região e outros detalhes… ex.: padarias em Curitiba abertas no último ano com WhatsApp"
          className="max-h-40 min-h-[56px] w-full resize-none bg-transparent px-3 pt-2 text-[15px] outline-none placeholder:text-ink/35"
        />
        <div className="flex items-center gap-2 pl-3">
          <span className="hidden text-[11px] text-muted sm:block">Enter para buscar · Shift+Enter quebra linha</span>
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label="Buscar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-ink transition hover:bg-lime-deep disabled:bg-ink/10 disabled:text-ink/30 ml-auto"
          >
            {enviando ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </div>
      </form>
      {abaixo}

    </section>
  );
}

function Entendido({ r }: { r: Interpretacao }) {
  const { segmentos, cidades, naoEncontradas } = r.entendido;
  if (!segmentos.length && !cidades.length && !naoEncontradas.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {segmentos.map((s) => (
        <span key={s.codigo} title={`CNAE ${s.codigo}`} className="flex max-w-[280px] items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-xs">
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

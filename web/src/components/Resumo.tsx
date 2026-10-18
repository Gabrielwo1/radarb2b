"use client";

import type { Resumo as TResumo } from "@/lib/api";
import { escala, numero, porcentagem } from "@/lib/formato";
import { tituloCidade } from "./Filtros";
import { cx } from "./ui";

export function Resumo({ dados, carregando, onCidade }: {
  dados: TResumo | null;
  carregando: boolean;
  onCidade: (codigo: number) => void;
}) {
  const max = Math.max(...(dados?.top_municipios.map((m) => m.total) ?? [1]));
  const anos = dados?.aberturas_por_ano ?? [];
  const maxAno = Math.max(1, ...anos.map((a) => a.total));

  return (
    <section className={cx("glass rounded-[var(--radius-card)] p-6 transition-opacity", carregando && dados && "opacity-60")}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Metrica rotulo="Empresas encontradas" valor={escala(dados?.total)} exato={numero(dados?.total)} sufixo="empresas ativas" carregando={!dados} />
        <Metrica
          rotulo="Com telefone"
          valor={porcentagem(dados?.com_telefone, dados?.total)}
          sufixo={`${escala(dados?.com_telefone)} com contato`}
          carregando={!dados}
        />
        <div>
          <p className="text-sm text-ink/60">Novas em 12 meses</p>
          {dados ? (
            <div className="mt-2 flex items-end gap-3">
              <span className="text-[30px] leading-none tracking-tight tabular-nums">{escala(dados.novas_12m)}</span>
              <div className="flex h-9 items-end gap-[3px]" title="Aberturas por ano">
                {anos.map((a, i) => (
                  <span
                    key={a.ano}
                    title={`${a.ano}: ${numero(a.total)}`}
                    style={{ height: `${Math.max(8, (a.total / maxAno) * 100)}%` }}
                    className={cx("w-[6px] rounded-full", i === anos.length - 1 ? "bg-ink" : "bg-steel/60")}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="skeleton mt-2 h-9 w-32 rounded-xl" />
          )}
        </div>
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-ink/60">Cidades com mais empresas</span>
          <span className="text-xs text-muted">clique para filtrar</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5">
          {(dados?.top_municipios ?? Array.from({ length: 5 }, () => null)).map((m, i) =>
            m ? (
              <button key={m.codigo} type="button" onClick={() => onCidade(m.codigo)} className="group text-left">
                <span className="block truncate text-sm group-hover:underline">{tituloCidade(m.nome)}</span>
                <span className="mt-2 block h-2.5 w-full rounded-full bg-ink/[0.07]">
                  <span className="bar-lime block h-full rounded-full" style={{ width: `${Math.max(6, (m.total / max) * 100)}%` }} />
                </span>
                <span className="mt-1.5 block text-xs text-muted" title={numero(m.total)}>{escala(m.total)}</span>
              </button>
            ) : (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function Metrica({ rotulo, valor, exato, sufixo, carregando }: { rotulo: string; valor: string; exato?: string; sufixo: string; carregando: boolean }) {
  return (
    <div>
      <p className="text-sm text-ink/60">{rotulo}</p>
      {carregando ? (
        <div className="skeleton mt-2 h-9 w-32 rounded-xl" />
      ) : (
        <p className="mt-2">
          <span className="block text-[30px] leading-none tracking-tight tabular-nums" title={exato}>{valor}</span>
          <span className="mt-1 block text-xs text-muted">{sufixo}</span>
        </p>
      )}
    </div>
  );
}

/** Top segmentos como "abas empilhadas" (estilo dos cartões Visa/Stripe/PayPal da referência). */
export function Segmentos({ dados, selecionados, onSegmento }: {
  dados: TResumo | null;
  selecionados: string[];
  onSegmento: (codigo: number) => void;
}) {
  const top = dados?.top_cnaes.slice(0, 3) ?? [];
  const total = dados?.total ?? 0;

  return (
    <section className="glass relative overflow-hidden rounded-[var(--radius-card)] p-6 pb-0">
      <div>
        <div>
          <p className="text-sm text-ink/60">Segmentos dominantes</p>
          <p className="mt-2 text-[34px] leading-none tracking-tight">
            {top[0] ? porcentagem(top.reduce((s, c) => s + c.total, 0), total) : "—"}
            <span className="ml-2 text-sm text-muted">da busca nos 3 maiores</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-2">
        {top.length === 0 &&
          [0, 1, 2].map((i) => <div key={i} className="skeleton h-24 flex-1 rounded-t-3xl" />)}
        {top.map((c, i) => {
          const ativo = selecionados.includes(String(c.codigo));
          const destaque = ativo || (selecionados.length === 0 && i === 0);
          return (
            <button
              key={c.codigo}
              type="button"
              onClick={() => onSegmento(c.codigo)}
              className={cx(
                "flex min-w-0 flex-1 flex-col justify-between rounded-t-3xl p-4 text-left transition-all",
                destaque ? "h-36 bg-lime" : "h-28 bg-white/60 hover:h-32 hover:bg-white",
              )}
            >
              <span className="text-sm font-semibold">#{c.codigo}</span>
              <span className="line-clamp-2 text-xs text-ink/70">{c.descricao}</span>
              <span className="text-xs text-ink/50" title={numero(c.total)}>{escala(c.total)} empresas</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

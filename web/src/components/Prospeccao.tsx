"use client";

import { Bookmark, BookmarkPlus, Database, Download, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Busca, type Empresa, type PontoMapa, type Resumo as TResumo, type Stats, urlApi, useApi } from "@/lib/api";
import { type Aba, UF_PADRAO, contarFiltros, lista, queryApi } from "@/lib/filtros";
import { useBuscasSalvas, useLocal, useSalvos } from "@/lib/local";
import { exigirLogin, useSessao } from "@/lib/sessao";
import { adicionarAoCrm, useEtapasCrm } from "@/lib/crm";
import { ehCelular, linkWhatsApp } from "@/lib/formato";
import { Assistente } from "./Assistente";
import { Detalhe } from "./Detalhe";
import { Filtros, TabFiltros } from "./Filtros";
import { PainelProspects } from "./Lista";
import { Resumo, Segmentos } from "./Resumo";
import { TopNav } from "./TopNav";
import { Popover, Toasts, avisar } from "./ui";

const MapaCalor = dynamic(() => import("./MapaCalor").then((m) => m.MapaCalor), {
  ssr: false,
  loading: () => <div className="glass skeleton h-full min-h-[440px] rounded-[var(--radius-card)]" />,
});

const POR_PAGINA = 30;

export function Prospeccao() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const aba = (sp.get("aba") as Aba) ?? "todas";
  const ordem = sp.get("ordem") ?? "nome";
  const uf = sp.get("uf") ?? UF_PADRAO;
  const { salvos, alternar, ehSalvo } = useSalvos();
  const [filtrosAbertos, setFiltrosAbertos] = useLocal("radar:painel-filtros", false);
  const { usuario, carregado } = useSessao();
  const logado = !!usuario;

  // Visitante navega livre; qualquer mudança de filtro/aba/ordem pede login antes (e é aplicada depois)
  const definir = useCallback(
    (mudancas: Record<string, string | null>) =>
      exigirLogin(() => {
        const q = new URLSearchParams(sp);
        for (const [k, v] of Object.entries(mudancas)) {
          if (v === null || v === "") q.delete(k);
          else q.set(k, v);
        }
        router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
      }, "Crie sua conta grátis para filtrar as empresas"),
    [sp, router, pathname],
  );

  // Busca conversacional: substitui os filtros atuais pelos interpretados (mantém aba e ordenação)
  const aplicarInterpretacao = (filtros: Record<string, string>) => {
    const q = new URLSearchParams(filtros);
    for (const k of ["aba", "ordem"]) if (sp.get(k)) q.set(k, sp.get(k)!);
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const alternarLista = (chave: string, valor: string) => {
    const atual = lista(sp.get(chave));
    const novo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
    definir({ [chave]: novo.join(",") || null });
  };

  // Query enviada à API (filtros + aba). Na aba "Salvos" restringe aos CNPJs salvos.
  const semSalvos = aba === "salvos" && salvos.length === 0;
  const apiQ = useMemo(
    () => queryApi(sp, aba === "salvos" ? { cnpjs: salvos.map((s) => s.cnpj).join(",") } : {}),
    [sp, aba, salvos],
  );
  const chave = apiQ.toString();

  const stats = useApi<Stats>(urlApi("stats")).dados;
  const resumo = useApi<TResumo>(semSalvos ? null : urlApi("resumo", apiQ));
  const mapa = useApi<PontoMapa[]>(semSalvos ? null : urlApi("mapa", apiQ));

  // Lista paginada ("carregar mais"), reiniciada quando a busca muda
  const [pagina, setPagina] = useState(1);
  const [itens, setItens] = useState<Empresa[]>([]);
  useEffect(() => { setPagina(1); setItens([]); }, [chave, ordem]);
  const listaQ = new URLSearchParams(apiQ);
  listaQ.set("ordem", ordem);
  listaQ.set("page", String(pagina));
  listaQ.set("limit", String(logado ? POR_PAGINA : 3)); // visitante vê uma prévia de 3
  const busca = useApi<Busca>(semSalvos || !carregado ? null : urlApi("empresas", listaQ));
  useEffect(() => {
    if (!busca.dados) return;
    const novos = busca.dados.resultados;
    setItens((atual) => (busca.dados!.pagina === 1 ? novos : [...atual, ...novos.filter((n) => !atual.some((a) => a.cnpj === n.cnpj))]));
  }, [busca.dados]);

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const fecharDetalhe = useCallback(() => setSelecionado(null), []);
  // CRM: adicionar em massa/individual e WhatsApp (abre a conversa e move para "Em contato")
  const etapasCrm = useEtapasCrm();
  const enviarAoCrm = (cnpjs: string[]) => exigirLogin(() => adicionar(cnpjs), "Crie sua conta para montar seu funil de vendas");
  const adicionar = async (cnpjs: string[]) => {
    try {
      const n = await adicionarAoCrm(cnpjs, { origem: "prospeccao" });
      avisar(n === 1 ? "Empresa adicionada ao CRM em Novos" : `${n} empresas adicionadas ao CRM`, { rotulo: "Ver CRM", href: "/crm" });
    } catch (e) {
      avisar(`Não foi possível adicionar: ${(e as Error).message}`);
    }
  };
  const chamarWhatsApp = (e: { cnpj: string; telefone1: string | null; telefone2?: string | null }) =>
    exigirLogin(() => abrirWhatsApp(e), "Crie sua conta para chamar no WhatsApp");
  const abrirWhatsApp = (e: { cnpj: string; telefone1: string | null; telefone2?: string | null }) => {
    const celular = [e.telefone1, e.telefone2].find(ehCelular);
    if (!celular) return;
    window.open(linkWhatsApp(celular), "_blank", "noopener");
    adicionarAoCrm([e.cnpj], { etapa: "contato", origem: "whatsapp" })
      .then(() => avisar("Conversa aberta · lead em “Em contato” no CRM", { rotulo: "Ver CRM", href: "/crm" }))
      .catch(() => {});
  };

  const salvar = (e: Empresa) =>
    exigirLogin(() => alternar({ cnpj: e.cnpj, nome: e.nome_fantasia || e.razao_social || e.cnpj, municipio: e.municipio }), "Crie sua conta para salvar empresas");
  const exportar = () => exigirLogin(() => { window.location.href = urlExportar; }, "Crie sua conta para exportar a lista");

  const exportarQ = new URLSearchParams(apiQ);
  const urlExportar = urlApi("exportar", exportarQ);
  const ultimaCarga = stats?.ultima_carga;
  const ufsCarregadas = ultimaCarga && ultimaCarga.ufs !== "ALL" ? ultimaCarga.ufs.split(",") : [];

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <TopNav pagina="prospeccao" />
      <Toasts />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-ink/60">
          <Database className="size-3.5" />
          {ultimaCarga
            ? `Base Receita Federal · ${ultimaCarga.mes_referencia.split("-").reverse().join("/")} · atualização mensal`
            : "Base Receita Federal"}
        </div>
        <div className="flex items-center gap-2">
          <BuscasSalvas query={sp.toString()} onAplicar={(q) => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })} />
          <button type="button" onClick={exportar} className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm text-white hover:bg-coal-2">
            <Download className="size-4" /> Exportar CSV
          </button>
        </div>
      </div>

      <Assistente
        uf={uf}
        total={resumo.carregando ? null : resumo.dados?.total ?? null}
        onAplicar={aplicarInterpretacao}
        abaixo={<TabFiltros aberto={filtrosAbertos} ativos={contarFiltros(sp)} onClick={() => setFiltrosAbertos((v) => !v)} />}
      />

      <Filtros sp={sp} definir={definir} ufsCarregadas={ufsCarregadas} aberto={filtrosAbertos} onFechar={() => setFiltrosAbertos(() => false)} />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-5">
          <Resumo dados={resumo.dados} carregando={resumo.carregando} onCidade={(c) => alternarLista("municipio", String(c))} />
          <Segmentos dados={resumo.dados} selecionados={lista(sp.get("cnae"))} onSegmento={(c) => alternarLista("cnae", String(c))} />
        </div>
        <div className="xl:col-span-7">
          <MapaCalor
            pontos={mapa.dados}
            uf={uf}
            selecionadas={lista(sp.get("municipio"))}
            onCidade={(c) => alternarLista("municipio", String(c))}
          />
        </div>
      </div>

      <PainelProspects
        aba={aba}
        onAba={(a) => definir({ aba: a === "todas" ? null : a })}
        total={semSalvos ? 0 : busca.dados?.total ?? null}
        empresas={semSalvos ? [] : itens}
        carregando={busca.carregando}
        temMais={logado && !!busca.dados && itens.length < busca.dados.total}
        bloqueado={carregado && !logado}
        onMais={() => setPagina((p) => p + 1)}
        selecionado={selecionado}
        onSelecionar={(c) => (c ? exigirLogin(() => setSelecionado(c), "Crie sua conta para ver telefone, e-mail e endereço") : setSelecionado(null))}
        ordem={ordem}
        onOrdem={(o) => definir({ ordem: o === "nome" ? null : o })}
        onExportar={exportar}
        ehSalvo={ehSalvo}
        onSalvar={salvar}
        totalSalvos={salvos.length}
        etapasCrm={etapasCrm}
        onCrm={enviarAoCrm}
        onWhatsApp={chamarWhatsApp}
      >
        {selecionado && (
          <Detalhe
            cnpj={selecionado}
            salvo={ehSalvo(selecionado)}
            onSalvar={salvar}
            onFechar={fecharDetalhe}
            etapaCrm={etapasCrm.get(selecionado)}
            onCrm={() => enviarAoCrm([selecionado])}
            onWhatsApp={chamarWhatsApp}
          />
        )}
      </PainelProspects>
    </main>
  );
}

function BuscasSalvas({ query, onAplicar }: { query: string; onAplicar: (q: string) => void }) {
  const { buscas, salvar, remover } = useBuscasSalvas();
  const [nome, setNome] = useState("");
  return (
    <Popover rotulo={`Buscas salvas${buscas.length ? ` · ${buscas.length}` : ""}`} icone={<Bookmark className="size-4" />} largura={340} alinhar="direita">
      {(fechar) => (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); if (nome.trim()) exigirLogin(() => { salvar(nome.trim(), query); setNome(""); }, "Crie sua conta para salvar buscas"); }}
            className="flex h-11 items-center gap-1 rounded-full border border-white bg-white/80 pl-4 pr-1"
          >
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da busca atual"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" />
            <button type="submit" className="flex h-9 items-center gap-1.5 rounded-full bg-lime px-3 text-sm font-medium">
              <BookmarkPlus className="size-4" /> Salvar
            </button>
          </form>
          <div className="mt-2 flex flex-col">
            {buscas.map((b) => (
              <div key={b.id} className="group flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-white/80">
                <button type="button" className="flex-1 truncate text-left text-sm" onClick={() => { onAplicar(b.query); fechar(); }}>
                  {b.nome}
                </button>
                <button type="button" aria-label="Remover busca" onClick={() => remover(b.id)} className="text-ink/30 hover:text-ink">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {!buscas.length && <p className="px-3 py-3 text-sm text-muted">Salve combinações de filtros para repetir a prospecção depois.</p>}
          </div>
        </>
      )}
    </Popover>
  );
}

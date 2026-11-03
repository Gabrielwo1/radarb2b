"use client";

import { ArrowLeft, Check, Copy, Loader2, Lock, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { atualizarConta } from "@/lib/conta";
import { ANUAL_SEM_DESCONTO, PAGINAS_AVULSO, PRECOS, type TipoCompra } from "@/lib/planos";
import { abrirAcesso, useSessao } from "@/lib/sessao";
import { cx } from "../ui";
import { reais } from "./Planos";

// Checkout transparente do Mercado Pago (Payment Brick): cartão de crédito/débito e Pix sem sair do site.
// O Brick tokeniza o cartão no navegador; o servidor cria o pagamento com o preço do plano.

type Brick = { unmount: () => void };
type MercadoPagoSdk = new (chave: string, op: { locale: string }) => {
  bricks: () => { create: (tipo: string, el: string, config: Record<string, unknown>) => Promise<Brick> };
};
declare global {
  interface Window { MercadoPago?: MercadoPagoSdk }
}

const RESUMO: Record<TipoCompra, { nome: string; itens: string[] }> = {
  avulso: { nome: "Consulta avulsa", itens: ["Esta pesquisa liberada por 30 dias", `Até ${PAGINAS_AVULSO} páginas de empresas`, "Telefone, WhatsApp e e-mail", "Exportar em CSV"] },
  pro_mensal: { nome: "Pro mensal", itens: ["Pesquisas e contatos ilimitados", "Todas as páginas", "CRM kanban completo", "Cartão renova todo mês · Pix vale 30 dias"] },
  pro_anual: { nome: "Pro anual", itens: ["Tudo do Pro por 12 meses", "40% de desconto", "Cartão em até 12x ou Pix à vista", "Pesquisas, contatos e CRM ilimitados"] },
};

type Resultado = { id?: number; status: string; detalhe?: string; erro?: string; pix?: { copiaECola: string; qr: string } | null };

export function Checkout() {
  const sp = useSearchParams();
  const router = useRouter();
  const tipo = (sp.get("plano") as TipoCompra) in PRECOS ? (sp.get("plano") as TipoCompra) : "pro_anual";
  const chave = sp.get("consulta");
  const preco = PRECOS[tipo];
  const { usuario, carregado } = useSessao();
  const [sdk, setSdk] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const brick = useRef<Brick | null>(null);

  useEffect(() => {
    if (carregado && !usuario) abrirAcesso("criar", "Crie sua conta para concluir a assinatura");
  }, [carregado, usuario]);

  // Monta o Payment Brick quando o SDK carrega e há usuário logado
  useEffect(() => {
    if (!sdk || !usuario || resultado || !window.MercadoPago) return;
    let cancelado = false;
    const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, { locale: "pt-BR" });
    mp.bricks().create("payment", "brick-pagamento", {
      initialization: { amount: preco.valor, payer: { email: usuario.email } },
      customization: {
        paymentMethods: {
          creditCard: "all",
          ...(tipo === "pro_mensal" ? {} : { debitCard: "all" }),
          bankTransfer: ["pix"],
          maxInstallments: preco.parcelas,
        },
        visual: { style: { theme: "default", customVariables: { baseColor: "#141518", borderRadiusLarge: "20px", borderRadiusMedium: "14px" } } },
      },
      callbacks: {
        onReady: () => !cancelado && setPronto(true),
        onError: (e: unknown) => console.error("Mercado Pago", e),
        onSubmit: async ({ selectedPaymentMethod, formData }: { selectedPaymentMethod: string; formData: Record<string, unknown> }) => {
          const r = await fetch("/api/pagamentos", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tipo, chave, metodo: selectedPaymentMethod, dados: formData }),
          });
          const corpo = (await r.json()) as Resultado;
          if (!r.ok) throw new Error(corpo.erro ?? "Pagamento não concluído");
          setResultado(corpo);
          if (corpo.status === "approved") atualizarConta();
        },
      },
    }).then((b) => {
      if (cancelado) b.unmount();
      else brick.current = b;
    });
    return () => {
      cancelado = true;
      brick.current?.unmount();
      brick.current = null;
    };
  }, [sdk, usuario, tipo, chave, preco, resultado]);

  // Pix: consulta a cada 4 s até aprovar
  useEffect(() => {
    if (resultado?.status !== "pending" || !resultado.id) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/pagamentos/${resultado.id}`).then((x) => x.json()).catch(() => null);
      if (r?.status && r.status !== "pending") {
        setResultado((atual) => (atual ? { ...atual, status: r.status, detalhe: r.detalhe } : atual));
        if (r.status === "approved") atualizarConta();
      }
    }, 4000);
    return () => clearInterval(t);
  }, [resultado?.status, resultado?.id]);

  const voltarApp = () => router.push(chave ? `/app?${chave}` : "/app");

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:py-14">
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdk(true)} />

      <aside className="relative h-fit overflow-hidden rounded-[var(--radius-panel)] bg-coal p-7 text-white">
        <span className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-lime/20 blur-[80px]" />
        <Link href="/planos" className="relative inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"><ArrowLeft className="size-4" /> Planos</Link>
        <p className="relative mt-6 text-sm text-white/55">Você está assinando</p>
        <h1 className="relative mt-1 text-3xl tracking-tight">{RESUMO[tipo].nome}</h1>
        <p className="relative mt-4 text-4xl tracking-tight text-lime">
          {tipo === "pro_anual" ? `12x ${reais(preco.valor / 12)}` : reais(preco.valor)}
          {tipo === "pro_mensal" && <span className="text-base text-white/55">/mês</span>}
        </p>
        {tipo === "pro_anual" && <p className="relative mt-1 text-sm text-white/55"><s>{reais(ANUAL_SEM_DESCONTO)}</s> por {reais(preco.valor)} no ano</p>}
        <ul className="relative mt-6 flex flex-col gap-2.5 text-sm text-white/80">
          {RESUMO[tipo].itens.map((i) => (
            <li key={i} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-lime text-ink"><Check className="size-3" /></span>{i}</li>
          ))}
        </ul>
        {tipo === "avulso" && !chave && <p className="relative mt-5 rounded-2xl bg-white/10 p-3 text-sm">Faça a pesquisa no app e toque em “Liberar esta pesquisa” para escolher o que comprar.</p>}
        <p className="relative mt-8 flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="size-4" /> Pagamento processado pelo Mercado Pago. Não guardamos dados do cartão.</p>
      </aside>

      <section className="glass rounded-[var(--radius-panel)] p-4 sm:p-6">
        {!resultado && (
          <>
            {(!pronto || !usuario) && (
              <div className="flex flex-col items-center gap-3 py-16 text-sm text-ink/60">
                {usuario ? <><Loader2 className="size-6 animate-spin" /> Carregando pagamento seguro…</> : <><Lock className="size-6" /> Entre na sua conta para pagar</>}
              </div>
            )}
            <div id="brick-pagamento" className={cx(!pronto && "hidden")} />
          </>
        )}

        {resultado?.status === "pending" && resultado.pix && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs text-lime"><QrCode className="size-3.5" /> Pague com Pix</span>
            <h2 className="text-2xl tracking-tight">Escaneie o QR code no app do seu banco</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${resultado.pix.qr}`} alt="QR code Pix" className="size-56 rounded-2xl bg-white p-3" />
            <CopiaECola codigo={resultado.pix.copiaECola} />
            <p className="flex items-center gap-2 text-sm text-ink/60"><Loader2 className="size-4 animate-spin" /> Aguardando o pagamento… a liberação é automática.</p>
          </div>
        )}

        {resultado?.status === "approved" && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-lime text-ink [animation:aparecer_.4s_ease-out]"><Check className="size-8" /></span>
            <h2 className="text-2xl tracking-tight">Pagamento aprovado!</h2>
            <p className="max-w-sm text-sm text-ink/60">{tipo === "avulso" ? "Sua pesquisa está liberada por 30 dias." : "Seu plano Pro já está ativo. Bom proveito!"}</p>
            <button type="button" onClick={voltarApp} className="flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm text-white hover:bg-coal-2">
              {tipo === "avulso" ? "Ver a pesquisa liberada" : "Ir para a prospecção"}
            </button>
          </div>
        )}

        {resultado && !["approved", "pending"].includes(resultado.status) && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <h2 className="text-2xl tracking-tight">Pagamento não aprovado</h2>
            <p className="max-w-sm text-sm text-ink/60">{textoRecusa(resultado.detalhe)}</p>
            <button type="button" onClick={() => { setPronto(false); setResultado(null); }} className="flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm text-white hover:bg-coal-2">
              Tentar de novo
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function CopiaECola({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(codigo).then(() => setCopiado(true))}
      className="flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-medium text-ink hover:bg-lime-deep">
      {copiado ? <Check className="size-4" /> : <Copy className="size-4" />} {copiado ? "Código copiado" : "Copiar código Pix (copia e cola)"}
    </button>
  );
}

function textoRecusa(detalhe?: string) {
  const textos: Record<string, string> = {
    cc_rejected_insufficient_amount: "Saldo ou limite insuficiente no cartão.",
    cc_rejected_bad_filled_security_code: "Código de segurança (CVV) incorreto.",
    cc_rejected_bad_filled_date: "Data de validade incorreta.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão.",
    cc_rejected_call_for_authorize: "O banco pediu autorização: ligue para ele e tente de novo.",
    cc_rejected_high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou o Pix.",
  };
  return (detalhe && textos[detalhe]) ?? "Tente outro cartão ou pague com Pix.";
}

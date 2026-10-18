"use client";

import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail, Radar, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { cx } from "../ui";

type Modo = "entrar" | "criar" | "recuperar";

const MENSAGENS: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  "User already registered": "Este e-mail já tem conta. Entre com sua senha.",
  "Password should be at least 6 characters.": "A senha precisa ter pelo menos 6 caracteres.",
};
const traduzir = (m: string) => MENSAGENS[m] ?? m;

export function Entrar() {
  const router = useRouter();
  const sp = useSearchParams();
  const volta = sp.get("volta") || "/";
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Lado da marca */}
      <section className="relative hidden overflow-hidden bg-coal p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-lime/20 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-40 left-10 size-[420px] rounded-full bg-steel/30 blur-[120px]" />
        <Link href="/landing" className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-lime text-ink"><Radar className="size-5" /></span>
          <span className="text-lg font-semibold tracking-tight">radar<span className="text-white/50">b2b</span></span>
        </Link>
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-5xl leading-[1.05] tracking-tight">
            28 milhões de empresas.<br /><span className="text-lime">Os seus próximos clientes</span> estão aqui.
          </h1>
          <ul className="mt-8 flex flex-col gap-3 text-white/75">
            {["Busca por linguagem natural em todo o Brasil", "WhatsApp em um clique e CRM kanban", "Base oficial da Receita, atualizada todo mês"].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-lime text-ink"><Check className="size-3.5" /></span>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Formulário */}
      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Link href="/landing" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="grid size-10 place-items-center rounded-full bg-ink text-lime"><Radar className="size-5" /></span>
          <span className="text-lg font-semibold tracking-tight">radar<span className="text-muted">b2b</span></span>
        </Link>

        <div className="glass w-full max-w-md rounded-[var(--radius-panel)] p-6 sm:p-8">
          <FormularioAcesso
            modoInicial={sp.get("modo") === "criar" ? "criar" : "entrar"}
            erroInicial={sp.get("erro") === "link" ? "Link inválido ou expirado. Peça um novo." : null}
            destinoConfirmacao={volta}
            onEntrou={() => { router.replace(volta); router.refresh(); }}
          />
        </div>

        <p className="mt-6 max-w-sm text-center text-xs text-ink/45">
          Seus leads, favoritos e buscas ficam na sua conta e só você tem acesso a eles.
        </p>
      </section>
    </main>
  );
}

/** Formulário de entrar / criar conta / recuperar senha, usado na página /entrar e no pop-up do app. */
export function FormularioAcesso({ modoInicial = "entrar", erroInicial = null, destinoConfirmacao = "/", onEntrou }: {
  modoInicial?: Modo;
  erroInicial?: string | null;
  /** Para onde o link de confirmação do e-mail leva de volta */
  destinoConfirmacao?: string;
  onEntrou: () => void;
}) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [aviso, setAviso] = useState<string | null>(null);

  const callback = (destino: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    const supabase = supabaseNavegador();
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        onEntrou();
      } else if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: callback(destinoConfirmacao) },
        });
        if (error) throw error;
        if (data.session) onEntrou();
        else setAviso(`Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar sua conta e voltar para cá.`);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/entrar/nova-senha") });
        if (error) throw error;
        setAviso(`Se existir uma conta com ${email}, você vai receber um link para criar uma nova senha.`);
      }
    } catch (err) {
      setErro(traduzir((err as Error).message));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {modo !== "recuperar" ? (
        <div className="mb-6 flex rounded-full bg-ink p-1">
          {(["criar", "entrar"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setModo(m); setErro(null); setAviso(null); }}
              className={cx("h-10 flex-1 rounded-full text-sm transition", modo === m ? "bg-lime font-medium text-ink" : "text-white/70 hover:text-white")}>
              {m === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <h2 className="text-2xl tracking-tight">Recuperar acesso</h2>
          <p className="mt-1 text-sm text-ink/60">Enviamos um link para você criar uma nova senha.</p>
        </div>
      )}

      <form onSubmit={enviar} className="flex flex-col gap-3">
        {modo === "criar" && (
          <Campo icone={<UserRound className="size-4" />} rotulo="Seu nome">
            <input required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Como podemos te chamar?" />
          </Campo>
        )}
        <Campo icone={<Mail className="size-4" />} rotulo="E-mail">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@empresa.com.br" />
        </Campo>
        {modo !== "recuperar" && (
          <Campo icone={<Lock className="size-4" />} rotulo="Senha"
            extra={
              <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"} className="text-ink/40 hover:text-ink">
                {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }>
            <input required minLength={6} type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === "criar" ? "new-password" : "current-password"} placeholder={modo === "criar" ? "Mínimo de 6 caracteres" : "Sua senha"} />
          </Campo>
        )}

        {erro && <p className="rounded-2xl bg-[#ffe1dc] px-4 py-2.5 text-sm text-[#b4232a]">{erro}</p>}
        {aviso && <p className="rounded-2xl bg-lime/60 px-4 py-2.5 text-sm text-ink">{aviso}</p>}

        <button type="submit" disabled={enviando}
          className="mt-2 flex h-12 items-center justify-between rounded-full bg-ink pl-5 pr-1.5 text-sm font-medium text-white transition hover:bg-coal-2 disabled:opacity-60">
          {modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar minha conta grátis" : "Enviar link"}
          <span className="grid size-9 place-items-center rounded-full bg-lime text-ink">
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          </span>
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-ink/60">
        {modo === "entrar" && (
          <button type="button" onClick={() => { setModo("recuperar"); setErro(null); }} className="hover:text-ink hover:underline">Esqueci minha senha</button>
        )}
        {modo === "recuperar" && (
          <button type="button" onClick={() => { setModo("entrar"); setAviso(null); }} className="hover:text-ink hover:underline">Voltar para o login</button>
        )}
      </div>
    </>
  );
}

function Campo({ icone, rotulo, extra, children }: { icone: React.ReactNode; rotulo: string; extra?: React.ReactNode; children: React.ReactElement }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-ink/60">{rotulo}</span>
      <span className="flex h-12 items-center gap-3 rounded-full border border-white bg-white/80 px-4 focus-within:ring-2 focus-within:ring-ink/15 [&_input]:h-full [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:text-sm [&_input]:outline-none [&_input]:placeholder:text-ink/35">
        <span className="text-ink/40">{icone}</span>
        {children}
        {extra}
      </span>
    </label>
  );
}

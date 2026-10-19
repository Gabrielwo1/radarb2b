"use client";

import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, Phone, Radar, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import { cx } from "../ui";

type Modo = "entrar" | "criar" | "recuperar";

const MENSAGENS: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  "User already registered": "Este e-mail já tem conta. Entre com sua senha.",
  "Password should be at least 6 characters.": "A senha precisa ter pelo menos 6 caracteres.",
};
const traduzir = (m: string) => {
  if (/rate limit/i.test(m)) return "Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (/only request this after/i.test(m)) return "Aguarde alguns segundos antes de pedir outro e-mail.";
  return MENSAGENS[m] ?? m;
};

export function Entrar() {
  const router = useRouter();
  const sp = useSearchParams();
  const volta = sp.get("volta") || "/app";
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Lado da marca */}
      <section className="relative hidden overflow-hidden bg-coal p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-lime/20 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-40 left-10 size-[420px] rounded-full bg-steel/30 blur-[120px]" />
        <Link href="/" className="relative flex items-center gap-2.5">
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
        <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
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
export function FormularioAcesso({ modoInicial = "entrar", erroInicial = null, destinoConfirmacao = "/app", onEntrou }: {
  modoInicial?: Modo;
  erroInicial?: string | null;
  /** Para onde o link de confirmação do e-mail leva de volta */
  destinoConfirmacao?: string;
  onEntrou: () => void;
}) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [verificando, setVerificando] = useState(false);
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
          options: { data: { nome: nome.trim(), telefone: telefone.replace(/\D/g, "") }, emailRedirectTo: callback(destinoConfirmacao) },
        });
        if (error) throw error;
        if (data.session) onEntrou();
        else setVerificando(true); // confirmação do e-mail dentro do próprio formulário
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

  if (verificando) {
    return (
      <VerificarEmail email={email} senha={senha} onEntrou={onEntrou}
        onTrocarEmail={() => { setVerificando(false); setErro(null); }} />
    );
  }

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
        {modo === "criar" && (
          <Campo icone={<Phone className="size-4" />} rotulo="WhatsApp / telefone">
            <input required type="tel" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(mascaraFone(e.target.value))}
              autoComplete="tel-national" placeholder="(41) 99999-9999" pattern="\(\d{2}\) \d{4,5}-\d{4}" title="Informe DDD e número" />
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

/** Máscara de telefone brasileiro: (41) 99999-9999 ou (41) 3333-4444 */
function mascaraFone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Com SMTP próprio, o e-mail traz um código de 6 dígitos: ligue NEXT_PUBLIC_CONFIRMACAO_CODIGO=1
const COM_CODIGO = process.env.NEXT_PUBLIC_CONFIRMACAO_CODIGO === "1";

/**
 * Etapa de confirmação do e-mail sem sair do pop-up.
 * Código de 6 dígitos (quando o e-mail traz) ou link: ao voltar para a aba, tenta entrar sozinho.
 */
function VerificarEmail({ email, senha, onEntrou, onTrocarEmail }: {
  email: string;
  senha: string;
  onEntrou: () => void;
  onTrocarEmail: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [espera, setEspera] = useState(60);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  // Confirmou pelo link (em outra aba): entrar com a senha já digitada funciona a partir daí
  const tentarEntrar = useCallback(async (manual: boolean) => {
    const { error } = await supabaseNavegador().auth.signInWithPassword({ email, password: senha });
    if (!error) return onEntrou();
    if (manual) setMsg({ tipo: "erro", texto: "Ainda não recebemos a confirmação. Abra o link do e-mail e tente de novo." });
  }, [email, senha, onEntrou]);

  useEffect(() => {
    const aoVoltar = () => document.visibilityState === "visible" && tentarEntrar(false);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [tentarEntrar]);

  const confirmarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    const { error } = await supabaseNavegador().auth.verifyOtp({ email, token: codigo, type: "signup" });
    setEnviando(false);
    if (error) setMsg({ tipo: "erro", texto: "Código inválido ou expirado. Confira o e-mail ou peça um novo." });
    else onEntrou();
  };

  const reenviar = async () => {
    const { error } = await supabaseNavegador().auth.resend({ type: "signup", email });
    if (error) setMsg({ tipo: "erro", texto: traduzir(error.message) });
    else { setMsg({ tipo: "ok", texto: `Enviamos de novo para ${email}.` }); setEspera(60); }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid size-14 place-items-center rounded-full bg-lime"><MailCheck className="size-6" /></span>
      <h4 className="mt-4 text-xl tracking-tight">Confirme seu e-mail</h4>
      <p className="mt-1 text-sm text-ink/60">
        Enviamos {COM_CODIGO ? "um código de 6 dígitos" : "um link de confirmação"} para <strong className="text-ink">{email}</strong>.
      </p>

      {COM_CODIGO ? (
        <form onSubmit={confirmarCodigo} className="mt-5 flex w-full flex-col gap-3">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric"
            autoComplete="one-time-code" autoFocus placeholder="000000" aria-label="Código de confirmação"
            className="h-14 w-full rounded-2xl border border-white bg-white/80 text-center text-3xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-ink/15" />
          <button type="submit" disabled={codigo.length !== 6 || enviando}
            className="flex h-12 items-center justify-between rounded-full bg-ink pl-5 pr-1.5 text-sm font-medium text-white hover:bg-coal-2 disabled:opacity-50">
            Confirmar e entrar
            <span className="grid size-9 place-items-center rounded-full bg-lime text-ink">{enviando ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}</span>
          </button>
        </form>
      ) : (
        <div className="mt-5 w-full rounded-2xl bg-white/70 p-4 text-left text-sm text-ink/70">
          <p className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-lime">1</span> Abra o e-mail e clique em <strong>Confirm your mail</strong>.</p>
          <p className="mt-2 flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-ink text-xs text-lime">2</span> Volte para esta aba: você entra automaticamente.</p>
        </div>
      )}

      {msg && <p className={cx("mt-3 w-full rounded-2xl px-4 py-2.5 text-sm", msg.tipo === "erro" ? "bg-[#ffe1dc] text-[#b4232a]" : "bg-lime/60")}>{msg.texto}</p>}

      <div className="mt-4 flex w-full flex-col gap-2">
        {!COM_CODIGO && (
          <button type="button" onClick={() => tentarEntrar(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-white hover:bg-coal-2">
            <Check className="size-4 text-lime" /> Já confirmei
          </button>
        )}
        <div className="flex items-center justify-center gap-4 text-sm text-ink/60">
          <button type="button" onClick={reenviar} disabled={espera > 0} className="hover:text-ink hover:underline disabled:no-underline disabled:opacity-60">
            {espera > 0 ? `Reenviar em ${espera}s` : "Reenviar e-mail"}
          </button>
          <span className="text-ink/20">•</span>
          <button type="button" onClick={onTrocarEmail} className="hover:text-ink hover:underline">Trocar e-mail</button>
        </div>
        <p className="text-xs text-ink/45">Não chegou? Confira a caixa de spam.</p>
      </div>
    </div>
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

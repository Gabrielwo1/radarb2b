"use client";

import { ArrowRight, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const { error } = await supabaseNavegador().auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) setErro(error.message === "Auth session missing!" ? "Link expirado. Peça um novo na tela de login." : error.message);
    else router.replace("/");
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={salvar} className="glass w-full max-w-md rounded-[var(--radius-panel)] p-8">
        <h1 className="text-2xl tracking-tight">Crie uma nova senha</h1>
        <p className="mt-1 text-sm text-ink/60">Depois disso você entra direto no app.</p>
        <label className="mt-6 flex h-12 items-center gap-3 rounded-full border border-white bg-white/80 px-4 focus-within:ring-2 focus-within:ring-ink/15">
          <Lock className="size-4 text-ink/40" />
          <input required minLength={6} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password"
            placeholder="Mínimo de 6 caracteres" className="h-full flex-1 bg-transparent text-sm outline-none" />
        </label>
        {erro && <p className="mt-3 rounded-2xl bg-[#ffe1dc] px-4 py-2.5 text-sm text-[#b4232a]">{erro}</p>}
        <button type="submit" disabled={enviando}
          className="mt-4 flex h-12 w-full items-center justify-between rounded-full bg-ink pl-5 pr-1.5 text-sm font-medium text-white hover:bg-coal-2">
          Salvar nova senha
          <span className="grid size-9 place-items-center rounded-full bg-lime text-ink">{enviando ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}</span>
        </button>
      </form>
    </main>
  );
}

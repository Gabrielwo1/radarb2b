import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente do servidor (Route Handlers e Server Components), lendo a sessão dos cookies. */
export async function supabaseServidor() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Component não pode gravar cookie; o proxy renova a sessão
        }
      },
    },
  });
}

/** Usuário logado, com o JWT validado (getClaims verifica a assinatura). */
export async function usuarioAtual() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  return c ? { id: c.sub as string, email: (c.email as string | undefined) ?? null } : null;
}

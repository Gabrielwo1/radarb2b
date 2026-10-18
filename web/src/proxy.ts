import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Renova a sessão do Supabase a cada requisição. As páginas são abertas; a proteção dos dados
// fica nas rotas de API, que validam o usuário antes de responder.

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  // Sem configuração do Supabase não há como checar sessão: não derruba o site (landing continua no ar)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.error("Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    return resposta;
  }

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  // O app é aberto para visitantes (o pop-up de acesso aparece na primeira ação);
  // quem já está logado não precisa ver a página de login.
  const { data } = await supabase.auth.getClaims();
  if (data?.claims && request.nextUrl.pathname === "/entrar") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|maplibre-gl-worker.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

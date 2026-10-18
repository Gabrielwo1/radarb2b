import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Renova a sessão do Supabase a cada requisição e manda quem não está logado para /entrar.
// É só a checagem otimista: as rotas de API validam o usuário de novo antes de responder.

const PUBLICAS = ["/landing", "/entrar", "/auth"];

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

  const { data } = await supabase.auth.getClaims();
  const logado = !!data?.claims;
  const caminho = request.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => caminho === p || caminho.startsWith(`${p}/`)) || caminho.startsWith("/api/");

  if (!logado && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = caminho === "/" ? "" : `?volta=${encodeURIComponent(caminho + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (logado && caminho === "/entrar") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|maplibre-gl-worker.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

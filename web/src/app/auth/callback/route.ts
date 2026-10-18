import { type NextRequest, NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

// Destino dos links de e-mail (confirmação de cadastro e recuperação de senha): troca o código pela sessão.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/app";
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (code) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", request.url));
}

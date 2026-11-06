import { supabaseServidor } from "@/lib/supabase/server";

// Registra uma visualização de página (painel /admin). Sem IP: só um id aleatório do navegador.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(req: Request) {
  const c = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!c || !UUID.test(c.visitante ?? "") || !c.caminho?.startsWith("/")) return new Response(null, { status: 204 });
  if (/bot|crawl|spider|preview|headless/i.test(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  const supabase = await supabaseServidor(); // com sessão, a visita fica ligada à conta
  await supabase.rpc("registrar_visita", {
    p_visitante: c.visitante,
    p_caminho: c.caminho.slice(0, 300),
    p_origem: c.origem?.slice(0, 200) ?? null,
    p_utm_source: c.utm_source?.slice(0, 100) ?? null,
    p_utm_campaign: c.utm_campaign?.slice(0, 100) ?? null,
    p_dispositivo: c.dispositivo === "mobile" ? "mobile" : "desktop",
  });
  return new Response(null, { status: 204 });
}

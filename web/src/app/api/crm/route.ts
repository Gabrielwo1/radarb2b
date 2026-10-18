import { supabaseServidor } from "@/lib/supabase/server";

// Adiciona empresas ao funil do usuário logado. Os dados da empresa vêm da base da VPS;
// a gravação usa a sessão do próprio usuário, então o RLS do Supabase garante o dono.

const ETAPAS = ["novo", "contato", "qualificado", "proposta", "negociacao", "ganho", "perdido"];

export async function POST(req: Request) {
  const supabase = await supabaseServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims) return Response.json({ erro: "Faça login para usar o CRM" }, { status: 401 });

  const corpo = (await req.json().catch(() => ({}))) as { cnpjs?: string[]; etapa?: string; origem?: string };
  const cnpjs = [...new Set((corpo.cnpjs ?? []).map((c) => String(c).replace(/\D/g, "")).filter((c) => c.length === 14))].slice(0, 500);
  const etapa = corpo.etapa ?? "novo";
  if (!cnpjs.length) return Response.json({ erro: "Informe ao menos um CNPJ" }, { status: 400 });
  if (!ETAPAS.includes(etapa)) return Response.json({ erro: "Etapa inválida" }, { status: 400 });

  const r = await fetch(`${process.env.API_URL}/snapshot`, {
    method: "POST",
    headers: { "x-api-key": process.env.API_KEY ?? "", "content-type": "application/json" },
    body: JSON.stringify({ cnpjs }),
    cache: "no-store",
  });
  if (!r.ok) return Response.json({ erro: "Base de empresas indisponível" }, { status: 502 });
  const empresas = (await r.json()) as { cnpj: string; dados: Record<string, unknown> }[];

  // Quem já está no funil: só avança de "novo" para uma etapa mais adiante (ex.: clique no WhatsApp)
  const { data: existentes, error: e1 } = await supabase.from("crm_leads").select("cnpj, etapa").in("cnpj", cnpjs);
  if (e1) return Response.json({ erro: e1.message }, { status: 500 });
  const jaTem = new Map((existentes ?? []).map((l) => [l.cnpj as string, l.etapa as string]));

  const { data: ultimo } = await supabase.from("crm_leads").select("ordem").eq("etapa", etapa)
    .order("ordem", { ascending: false }).limit(1).maybeSingle();
  let ordem = Number(ultimo?.ordem ?? 0);

  const novos = empresas.filter((e) => !jaTem.has(e.cnpj)).map((e) => ({
    cnpj: e.cnpj, etapa, ordem: ++ordem, origem: corpo.origem ?? null, dados: e.dados,
  }));
  if (novos.length) {
    const { error } = await supabase.from("crm_leads").insert(novos);
    if (error) return Response.json({ erro: error.message }, { status: 500 });
  }

  const avancar = etapa !== "novo" ? [...jaTem].filter(([, et]) => et === "novo").map(([c]) => c) : [];
  if (avancar.length) {
    const { error } = await supabase.from("crm_leads").update({ etapa }).in("cnpj", avancar);
    if (error) return Response.json({ erro: error.message }, { status: 500 });
  }

  return Response.json({ adicionados: novos.length + avancar.length });
}

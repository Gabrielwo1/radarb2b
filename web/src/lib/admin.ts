import { supabaseSemSessao } from "./emails/enviar";
import { usuarioAtual } from "./supabase/server";

// Acesso ao painel /admin: só e-mails listados em ADMIN_EMAILS (separados por vírgula).
const ADMINS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const DEV_SEM_LOGIN = process.env.NODE_ENV !== "production" && process.env.DEV_SEM_LOGIN === "1";

export async function adminAtual() {
  if (DEV_SEM_LOGIN) return { id: "dev", email: "modo-dev@localhost" };
  const u = await usuarioAtual();
  return u?.email && ADMINS.includes(u.email.toLowerCase()) ? u : null;
}

/** Chama uma função admin_* do banco com o segredo do servidor. */
export async function consultaAdmin<T>(fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabaseSemSessao().rpc(fn, { p_segredo: process.env.PAGAMENTOS_SEGREDO, ...args });
  if (error) throw new Error(error.message);
  return data as T;
}

export async function respostaAdmin(fn: string, args?: Record<string, unknown>) {
  if (!(await adminAtual())) return Response.json({ erro: "Acesso restrito" }, { status: 403 });
  try {
    return Response.json(await consultaAdmin(fn, args), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 500 });
  }
}

import { respostaAdmin } from "@/lib/admin";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/contas/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ erro: "Conta inválida" }, { status: 400 });
  return respostaAdmin("admin_conta", { p_user: id });
}

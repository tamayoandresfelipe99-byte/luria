import { supabaseServer } from "@/lib/supabase/server";
import { appConfig } from "@/lib/services/factory";
import { json, sameOrigin } from "@/lib/security/request";
import { trackServer } from "@/lib/analytics/server";

/** Cancelar o reanudar cobros futuros. La vigencia pagada no se toca (A12). */
export async function POST(req: Request) {
  if (!sameOrigin(req, appConfig().appUrl)) return json({ error: "Origen no permitido" }, 403);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "Inicia sesión" }, 401);
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "cancel" && body.action !== "resume") return json({ error: "Acción inválida" }, 400);
  const { error } = await sb.rpc(body.action === "cancel" ? "fn_cancel_renewal" : "fn_resume_renewal");
  if (error) return json({ error: "No fue posible actualizar la renovación." }, 409);
  if (body.action === "cancel") await trackServer("cancellation", crypto.randomUUID());
  return json({ ok: true });
}

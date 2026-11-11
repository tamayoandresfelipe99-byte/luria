import { supabaseServer } from "@/lib/supabase/server";
import { supportSchema } from "@/lib/validation";
import { appConfig } from "@/lib/services/factory";
import { json, rateLimitShared, sameOrigin } from "@/lib/security/request";

export async function POST(req: Request) {
  if (!sameOrigin(req, appConfig().appUrl)) return json({ error: "Origen no permitido" }, 403);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "Inicia sesión" }, 401);
  if (!(await rateLimitShared(`sup:${auth.user.id}`, 5, 60 * 60_000))) return json({ error: "Has enviado varias solicitudes. Espera un momento." }, 429);
  const parsed = supportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, 400);
  const { error } = await sb.from("support_requests").insert({ user_id: auth.user.id, ...parsed.data });
  if (error) return json({ error: "No pudimos registrar la solicitud." }, 500);
  return json({ ok: true }, 201);
}

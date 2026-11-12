import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appConfig, licenseAdapter } from "@/lib/services/factory";
import { json, rateLimitShared, sameOrigin } from "@/lib/security/request";

const url = z
  .string()
  .trim()
  .max(2048, "El enlace es demasiado largo")
  .url({ error: "Escribe un enlace completo, por ejemplo https://…" })
  .refine((v) => v.startsWith("https://") && !/[\s<>"'`]/.test(v), "El enlace debe empezar por https:// y no contener espacios");

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_link"), userId: z.uuid({ error: "Cliente inválido" }), url }).strict(),
  z.object({ action: z.literal("enable"), userId: z.uuid({ error: "Cliente inválido" }) }).strict(),
  z.object({ action: z.literal("revoke"), userId: z.uuid({ error: "Cliente inválido" }), reason: z.string().trim().min(5, "Indica el motivo (mínimo 5 caracteres)").max(500) }).strict(),
]);

/**
 * Gestión del acceso a LURIA (solo administradores). La autorización se comprueba aquí y de nuevo
 * dentro de cada función SQL (`fn_require_admin`), que además valida la vigencia y deja auditoría.
 */
export async function POST(req: Request) {
  const cfg = appConfig();
  if (!sameOrigin(req, cfg.appUrl)) return json({ error: "Origen no permitido" }, 403);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No autenticado" }, 401);
  const { data: isAdmin } = await sb.rpc("has_role", { r: "admin" });
  if (!isAdmin) return json({ error: "Solo administradores" }, 403);
  if (!(await rateLimitShared(`accesos:${auth.user.id}`, 120, 10 * 60_000))) return json({ error: "Demasiadas solicitudes" }, 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return json({ error: issue && issue.code !== "unrecognized_keys" && issue.code !== "invalid_union" ? issue.message : "Solicitud inválida" }, 400);
  }
  const v = parsed.data;

  // Llamadas con la sesión del administrador: la función SQL vuelve a verificar su rol.
  const { error } =
    v.action === "save_link"
      ? await sb.rpc("fn_access_save_link", { p_user: v.userId, p_url: v.url })
      : v.action === "enable"
        ? await sb.rpc("fn_access_enable", { p_user: v.userId })
        : await sb.rpc("fn_access_revoke", { p_user: v.userId, p_reason: v.reason });
  if (error) {
    const known = error.code === "22023" || error.code === "42501";
    return json({ error: known ? error.message : "No fue posible completar la acción." }, error.code === "42501" ? 403 : 409);
  }

  // Revocar también retira la licencia en el sistema de la extensión (si existe una activa).
  if (v.action === "revoke") {
    const { data: lic } = await supabaseAdmin().from("licenses").select("external_license_id, status").eq("user_id", v.userId).maybeSingle();
    const l = lic as { external_license_id: string | null; status: string } | null;
    if (l?.external_license_id && l.status === "active") {
      await licenseAdapter()
        .revoke({ externalLicenseId: l.external_license_id, reason: "admin", idempotencyKey: `access-revoke:${v.userId}:${Date.now()}` })
        .catch(() => undefined);
    }
  }
  return json({ ok: true });
}

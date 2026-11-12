import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appConfig } from "@/lib/services/factory";
import { issueLicenseToken } from "@/lib/licensing/token";
import { json, rateLimitShared } from "@/lib/security/request";

/**
 * OPCIÓN B (propuesta, inactiva hasta que la extensión la adopte; requiere LICENSE_TOKEN_PRIVATE_KEY).
 * La extensión envía el token de sesión del usuario (Authorization: Bearer) y recibe un token firmado
 * cuyo vencimiento nunca supera la vigencia pagada (A22).
 */
export async function POST(req: Request) {
  const cfg = appConfig();
  if (!cfg.licenseTokenPrivateKey) return json({ error: "Validación de licencias no habilitada" }, 503);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "No autenticado" }, 401);
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: auth } = await anon.auth.getUser(bearer);
  if (!auth.user) return json({ error: "No autenticado" }, 401);
  if (!(await rateLimitShared(`lic:${auth.user.id}`, 30, 60 * 60_000))) return json({ error: "Demasiadas solicitudes" }, 429);
  const db = supabaseAdmin();
  const [{ data: lic }, { data: prof }, { data: grant }, { data: current }] = await Promise.all([
    db.from("licenses").select("id, status, valid_until").eq("user_id", auth.user.id).maybeSingle(),
    db.from("profiles").select("external_ref").eq("id", auth.user.id).single(),
    db.from("access_grants").select("status").eq("user_id", auth.user.id).maybeSingle(),
    db.rpc("fn_subscription_current", { p_user: auth.user.id }),
  ]);
  const l = lic as { id: string; status: string; valid_until: string | null } | null;
  if (!l || l.status !== "active") return json({ active: false }, 200);
  // Acceso efectivo = licencia activa + acceso habilitado por un administrador + suscripción vigente.
  // Revocar o suspender el acceso en el panel, o el vencimiento, cortan la emisión de tokens a la extensión.
  if ((grant as { status: string } | null)?.status !== "habilitado" || current !== true) return json({ active: false }, 200);
  const issued = issueLicenseToken(cfg.licenseTokenPrivateKey, {
    externalUserRef: (prof as { external_ref: string }).external_ref,
    licenseId: l.id,
    validUntil: l.valid_until ? new Date(l.valid_until) : null,
    now: new Date(),
    ttlMs: cfg.licenseTokenTtlHours * 3600_000,
  });
  if (!issued) return json({ active: false }, 200);
  return json({ active: true, token: issued.token, expires_at: issued.expiresAt.toISOString() });
}

import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appConfig, licenseAdapter } from "@/lib/services/factory";

/**
 * Tarea programada diaria (p. ej. Vercel Cron 05:00 America/Bogota → 10:00 UTC).
 * Expira pedidos y suscripciones vencidas y revoca licencias en el mecanismo técnico (A11).
 * Autenticación: Authorization: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  const cfg = appConfig();
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${cfg.cronSecret}`);
  if (!cfg.cronSecret || got.length !== want.length || !timingSafeEqual(got, want)) return new Response(null, { status: 401 });
  const { data, error } = await supabaseAdmin().rpc("fn_expire_due", { p_now: new Date().toISOString() });
  if (error) return new Response(null, { status: 500 });
  const rows = (data ?? []) as { subscription_id: string; external_license_id: string | null }[];
  let revoked = 0;
  for (const r of rows) {
    if (!r.external_license_id) continue;
    const res = await licenseAdapter().revoke({ externalLicenseId: r.external_license_id, reason: "expired", idempotencyKey: `expire:${r.subscription_id}:${new Date().toISOString().slice(0, 10)}` });
    if (res.ok) revoked++;
  }
  // Limpieza del límite de solicitudes compartido (claves inactivas > 1 día). No bloquea la tarea.
  const { data: cleaned } = await supabaseAdmin().rpc("fn_rate_limit_cleanup");
  return Response.json({ expired: rows.length, revoked, rateLimitKeysCleaned: typeof cleaned === "number" ? cleaned : 0 });
}

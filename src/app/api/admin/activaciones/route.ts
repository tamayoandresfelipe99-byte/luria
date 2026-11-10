import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appConfig, licenseAdapter } from "@/lib/services/factory";
import { json, sameOrigin } from "@/lib/security/request";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retry"), taskId: z.string().uuid() }).strict(),
  // Activación manual: solo si existe un mecanismo real de vigencia y revocación (LICENSE_MANUAL_REVOCATION_CONFIRMED).
  z.object({ action: z.literal("complete_manual"), taskId: z.string().uuid(), externalLicenseId: z.string().trim().min(3).max(120), note: z.string().trim().min(10).max(500) }).strict(),
]);

export async function POST(req: Request) {
  const cfg = appConfig();
  if (!sameOrigin(req, cfg.appUrl)) return json({ error: "Origen no permitido" }, 403);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No autenticado" }, 401);
  const { data: isAdmin } = await sb.rpc("has_role", { r: "admin" });
  if (!isAdmin) return json({ error: "Solo administradores" }, 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Solicitud inválida" }, 400);
  const db = supabaseAdmin();
  const { data: task } = await db.from("activation_tasks").select("id, payment_id, subscription_id, kind, status").eq("id", parsed.data.taskId).single();
  const t = task as { id: string; payment_id: string; subscription_id: string; kind: "activation" | "revocation"; status: string } | null;
  if (!t || t.status === "done") return json({ error: "Tarea inexistente o cerrada" }, 404);
  const { data: sub } = await db.from("subscriptions").select("user_id, current_period_end, status").eq("id", t.subscription_id).single();
  const s = sub as { user_id: string; current_period_end: string; status: string };

  if (parsed.data.action === "complete_manual") {
    if (cfg.licenseAdapter !== "manual" || !cfg.licenseManualRevocationConfirmed)
      return json({ error: "La activación manual no está autorizada: falta un mecanismo real de vigencia y revocación." }, 409);
    if (t.kind !== "activation" || s.status === "revoked") return json({ error: "No aplica" }, 409);
    await db.rpc("fn_mark_license_active", { p_subscription_id: t.subscription_id, p_external_license_id: parsed.data.externalLicenseId, p_valid_until: s.current_period_end, p_actor: auth.user.id });
    await db.from("activation_tasks").update({ resolution_note: parsed.data.note, assigned_to: auth.user.id }).eq("id", t.id);
    return json({ ok: true });
  }

  const { data: prof } = await db.from("profiles").select("external_ref").eq("id", s.user_id).single();
  const res = await licenseAdapter().grant({
    userId: s.user_id,
    externalUserRef: (prof as { external_ref: string }).external_ref,
    subscriptionId: t.subscription_id,
    validUntil: new Date(s.current_period_end),
    idempotencyKey: `grant:${t.payment_id}`,
  });
  if (res.ok) {
    await db.rpc("fn_mark_license_active", { p_subscription_id: t.subscription_id, p_external_license_id: res.externalLicenseId, p_valid_until: s.current_period_end, p_actor: auth.user.id });
    return json({ ok: true });
  }
  await db.rpc("fn_upsert_activation_task", { p_payment_id: t.payment_id, p_subscription_id: t.subscription_id, p_kind: "activation", p_error_code: res.code, p_error_message: res.message, p_sla_hours: cfg.activationSlaHours });
  return json({ ok: false, error: res.message }, 502);
}

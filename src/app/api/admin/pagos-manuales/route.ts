import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appConfig, licenseAdapter } from "@/lib/services/factory";
import { manualPaymentSchema } from "@/lib/validation";
import { json, sameOrigin } from "@/lib/security/request";
import { SupabasePaymentRepo } from "@/lib/supabase/repo";

/**
 * Registro de un pago manual (p. ej. Nequi del flujo actual) CON EVIDENCIA.
 * No permite "marcar aprobado" sin referencia externa, importe exacto, fecha y nota de verificación.
 * La función SQL exige rol admin, impide reutilizar la misma referencia y deja auditoría.
 */
export async function POST(req: Request) {
  const cfg = appConfig();
  if (!sameOrigin(req, cfg.appUrl)) return json({ error: "Origen no permitido" }, 403);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "No autenticado" }, 401);
  const { data: isAdmin } = await sb.rpc("has_role", { r: "admin" });
  if (!isAdmin) return json({ error: "Solo administradores" }, 403);
  const parsed = manualPaymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Datos incompletos: se requiere referencia, valor, fecha y evidencia." }, 400);
  const v = parsed.data;
  const { data, error } = await supabaseAdmin().rpc("fn_register_manual_payment", {
    p_actor: auth.user.id,
    p_order_reference: v.orderReference,
    p_method: v.method,
    p_external_ref: v.externalReference,
    p_amount_cop: v.amountCop,
    p_paid_at: v.paidAt,
    p_evidence_note: v.evidenceNote,
  });
  if (error) return json({ error: error.message }, 409);
  const r = data as { outcome: string; payment_id: string; period?: { subscription_id: string; user_id: string; period_end: string } };
  if (r.outcome === "applied" && r.period) {
    const repo = new SupabasePaymentRepo(cfg.activationSlaHours);
    const lic = await licenseAdapter().grant({
      userId: r.period.user_id,
      externalUserRef: await repo.externalUserRef(r.period.user_id),
      subscriptionId: r.period.subscription_id,
      validUntil: new Date(r.period.period_end),
      idempotencyKey: `grant:${r.payment_id}`,
    });
    if (lic.ok) await repo.markLicenseActive({ subscriptionId: r.period.subscription_id, externalLicenseId: lic.externalLicenseId, validUntil: new Date(r.period.period_end) });
    else await repo.upsertActivationTask({ paymentId: r.payment_id, subscriptionId: r.period.subscription_id, kind: "activation", errorCode: lic.code, errorMessage: lic.message });
  }
  return json(r);
}

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appConfig, paymentProvider } from "@/lib/services/factory";
import { realChargesEnabled, simulationAllowed } from "@/lib/config";
import { purchaseGate } from "@/lib/domain/access";
import { createOrderSchema } from "@/lib/validation";
import { json, rateLimit, sameOrigin } from "@/lib/security/request";
import { loadCustomerView } from "@/lib/services/customer";

/** Crea (o reutiliza) el pedido y devuelve la URL de la pasarela. El precio sale de la base de datos. */
export async function POST(req: Request) {
  const cfg = appConfig();
  if (!sameOrigin(req, cfg.appUrl)) return json({ error: "Origen no permitido" }, 403);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "Inicia sesión" }, 401);
  if (!rateLimit(`compra:${auth.user.id}`, 6, 10 * 60_000)) return json({ error: "Demasiados intentos" }, 429);

  const parsed = createOrderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Solicitud inválida" }, 400); // A04: rechaza campos extra (amount, price…)

  const view = await loadCustomerView();
  const gate = purchaseGate({
    authenticated: true,
    acceptedTerms: parsed.data.acceptPurchaseTerms,
    acknowledgedDesktopRequirement: parsed.data.acknowledgedDesktop,
    eligibility: view.eligibilityVerified ? "verified" : "unverified",
    realChargesEnabled: realChargesEnabled(cfg),
    simulationAllowed: simulationAllowed(cfg),
    hasActiveFuturePeriod: view.hasFuturePeriod,
  });
  if (!gate.allowed) return json({ error: gate.reasons.join(" ") }, 409);

  const provider = paymentProvider();
  if (!provider) return json({ error: "La pasarela de pagos no está configurada." }, 503);

  const { data: order, error } = await supabaseAdmin().rpc("fn_create_order", { p_user: auth.user.id, p_idempotency_key: parsed.data.idempotencyKey });
  if (error || !order) return json({ error: "No pudimos crear el pedido." }, 500);
  const o = order as { reference: string; amount_cop: number; currency: "COP" };

  // Registrar la aceptación de las condiciones de compra para este pedido.
  await sb.from("consents").insert({ user_id: auth.user.id, purpose: "terms", granted: true, notice_version: `compra:${o.reference}` });

  const checkout = await provider.createCheckout({
    reference: o.reference,
    amountCop: o.amount_cop,
    currency: o.currency,
    customerEmail: auth.user.email ?? "",
    redirectUrl: `${cfg.appUrl}/pago/resultado?referencia=${encodeURIComponent(o.reference)}`,
  });
  return json({ url: checkout.url, simulated: checkout.simulated, reference: o.reference });
}

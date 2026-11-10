import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { appConfig, licenseAdapter, paymentProvider } from "@/lib/services/factory";
import { simulationAllowed } from "@/lib/config";
import { buildSignedEvent, fakeTxId, type MockPaymentProvider } from "@/lib/payments/mock";
import { mapWompiStatus } from "@/lib/payments/wompi";
import { processPaymentWebhook } from "@/lib/services/payment-processor";
import { SupabasePaymentRepo } from "@/lib/supabase/repo";
import { json } from "@/lib/security/request";

/** SOLO DESARROLLO: simula la pasarela y envía el evento firmado al mismo procesador que usa producción. */
export async function POST(req: Request) {
  const cfg = appConfig();
  if (!simulationAllowed(cfg)) notFound();
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: "Inicia sesión" }, 401);
  const body = (await req.json()) as { reference: string; status: "APPROVED" | "DECLINED" | "PENDING" };
  const { data: order } = await sb.from("orders").select("reference, amount_cop").eq("reference", body.reference).maybeSingle();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  const o = order as { reference: string; amount_cop: number };
  const provider = paymentProvider() as MockPaymentProvider;
  const txId = fakeTxId(`${o.reference}:${Date.now()}`);
  const now = new Date();
  provider.store.set(txId, {
    provider: "mock",
    transactionId: txId,
    reference: o.reference,
    amountInCents: o.amount_cop * 100,
    currency: "COP",
    status: mapWompiStatus(body.status),
    paymentMethodType: "SIMULADO",
    finalizedAt: body.status === "PENDING" ? null : now,
  });
  const raw = buildSignedEvent({ id: txId, reference: o.reference, status: body.status, amount_in_cents: o.amount_cop * 100 }, Math.floor(now.getTime() / 1000));
  const result = await processPaymentWebhook(
    { provider, repo: new SupabasePaymentRepo(cfg.activationSlaHours), licenses: licenseAdapter(), now: () => new Date() },
    raw,
    new Headers(),
  );
  return json(result, result.httpStatus);
}

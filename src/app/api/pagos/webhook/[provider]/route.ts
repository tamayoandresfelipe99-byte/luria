import { appConfig, licenseAdapter, paymentProvider } from "@/lib/services/factory";
import { processPaymentWebhook } from "@/lib/services/payment-processor";
import { SupabasePaymentRepo } from "@/lib/supabase/repo";
import { trackServer } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

/**
 * URL de eventos para la pasarela: /api/pagos/webhook/wompi
 * Autenticación por firma (no por sesión ni origen). Responde 200 a lo procesado o ignorado
 * para que la pasarela no reintente; 401 a firmas inválidas; 503 si no se pudo confirmar con el proveedor.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: slug } = await ctx.params;
  const provider = paymentProvider();
  if (!provider || provider.id !== slug) return new Response(null, { status: 404 });
  const raw = await req.text();
  if (raw.length > 64 * 1024) return new Response(null, { status: 413 });
  try {
    const result = await processPaymentWebhook(
      { provider, repo: new SupabasePaymentRepo(appConfig().activationSlaHours), licenses: licenseAdapter(), now: () => new Date() },
      raw,
      req.headers,
    );
    if (result.outcome === "applied:approved") await trackServer("payment_verified", crypto.randomUUID());
    return new Response(null, { status: result.httpStatus, headers: { "x-luria-outcome": result.outcome } });
  } catch (e) {
    console.error("webhook_error", e instanceof Error ? e.message : "desconocido");
    return new Response(null, { status: 500 });
  }
}

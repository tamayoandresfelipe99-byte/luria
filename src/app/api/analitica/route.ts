import { supabaseAdmin } from "@/lib/supabase/admin";
import { ANALYTICS_EVENTS, ACQUISITION_CHANNELS, sanitizePath } from "@/lib/analytics/events";
import { clientIp, rateLimit } from "@/lib/security/request";

/** Eventos de navegación (solo con consentimiento; lo verifica el cliente y aquí la cookie). Sin datos personales. */
export async function POST(req: Request) {
  if (!req.headers.get("cookie")?.includes("luria_analytics=granted")) return new Response(null, { status: 204 });
  if (!rateLimit(`an:${clientIp(req)}`, 120, 60_000)) return new Response(null, { status: 204 });
  const b = (await req.json().catch(() => null)) as { event?: string; anonId?: string; path?: string; channel?: string } | null;
  // Los eventos financieros (payment_verified, activation_done…) solo los emite el servidor.
  const allowedFromClient = ["page_view", "pricing_view", "compat_check", "signup_start", "signup_done", "checkout_start"];
  if (!b?.event || !allowedFromClient.includes(b.event) || !ANALYTICS_EVENTS.includes(b.event as never)) return new Response(null, { status: 204 });
  if (!b.anonId || !/^[a-f0-9-]{36}$/.test(b.anonId)) return new Response(null, { status: 204 });
  const channel = ACQUISITION_CHANNELS.includes(b.channel as never) ? b.channel : null;
  await supabaseAdmin().from("analytics_events").insert({ event: b.event, anon_id: b.anonId, path: sanitizePath(b.path ?? "/"), channel });
  return new Response(null, { status: 204 });
}

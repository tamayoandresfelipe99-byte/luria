import "server-only";
import { supabaseAdmin } from "../supabase/admin";
import { sanitizePath, type AnalyticsEvent } from "./events";

/** Registro de eventos del servidor (p. ej. payment_verified). Falla en silencio: la analítica nunca bloquea el negocio. */
export async function trackServer(event: AnalyticsEvent, anonId: string, path?: string, channel?: string) {
  try {
    await supabaseAdmin().from("analytics_events").insert({ event, anon_id: anonId, path: path ? sanitizePath(path) : null, channel: channel ?? null });
  } catch {
    /* sin efectos */
  }
}

import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Protección CSRF para rutas API que cambian estado: el encabezado Origin debe coincidir
 * con la URL pública. Las cookies de Supabase son SameSite=Lax; esta verificación añade defensa.
 * Los webhooks NO usan esta verificación (se autentican por firma).
 */
export function sameOrigin(req: Request, appUrl: string): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Límite de solicitudes en memoria por instancia (ventana deslizante simple).
 * Respaldo de `rateLimitShared` cuando la base de datos no responde, y suficiente para pruebas.
 */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

/** Resumen SHA-256 de la clave: la base de datos nunca guarda IP, correo ni ids en claro. */
export function rateLimitKeyHash(key: string): string {
  return createHash("sha256").update(`luria-rl:${key}`).digest("hex");
}

/**
 * Límite compartido entre instancias (tabla `rate_limits`, función `fn_rate_limit_hit`).
 * Si la base de datos falla, usa el límite en memoria: proteger sin bloquear el negocio.
 */
export async function rateLimitShared(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc("fn_rate_limit_hit", {
      p_key_hash: rateLimitKeyHash(key),
      p_max: max,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error || typeof data !== "boolean") throw error ?? new Error("respuesta inesperada");
    return data;
  } catch {
    return rateLimit(key, max, windowMs);
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

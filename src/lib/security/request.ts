import "server-only";

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
 * SUFICIENTE PARA PROTOTIPO. En producción con varias instancias, sustituir por un
 * almacén compartido (p. ej. tabla en Postgres o Redis gestionado). Ver docs/seguridad.md.
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

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

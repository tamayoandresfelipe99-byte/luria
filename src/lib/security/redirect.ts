/**
 * Destino interno seguro para parámetros como `?siguiente=`. Evita redirecciones abiertas:
 * rechaza URL absolutas, `//host`, barras invertidas (`/\host` se interpreta como `//host`),
 * caracteres de control y cualquier ruta cuyo origen resuelto no sea el propio sitio.
 */
export function safeInternalPath(value: unknown, fallback = "/cuenta"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "https://interno.invalid";
    const u = new URL(value, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/**
 * Taxonomía de eventos de conversión. Separados de los registros financieros:
 * "payment_verified" se emite desde el servidor después de la verificación, nunca desde el navegador.
 * Ningún evento lleva datos personales (correo, nombre, teléfono, referencia de pedido).
 */
export const ANALYTICS_EVENTS = [
  "page_view",
  "pricing_view",
  "compat_check",
  "signup_start",
  "signup_done",
  "checkout_start",
  "payment_verified",
  "activation_done",
  "renewal_done",
  "cancellation",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const ACQUISITION_CHANNELS = ["whatsapp", "referido", "organico", "redes", "directo", "otro"] as const;

/** Elimina de una ruta cualquier parámetro que pueda contener datos personales. */
export function sanitizePath(path: string): string {
  const [p] = path.split("?");
  return (p ?? "/").replace(/[^\w\-/]/g, "").slice(0, 200) || "/";
}

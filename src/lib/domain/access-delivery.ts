/**
 * Separación entre el estado de pago (A) y el estado de entrega del acceso (B).
 * El estado de pago lo calcula la base de datos (`fn_payment_state`); el de acceso lo gestiona un administrador.
 */
export type PaymentState = "pendiente_pago" | "en_verificacion" | "al_dia" | "por_vencer" | "vencido";
export type AccessStatus = "pendiente" | "enlace_guardado" | "habilitado" | "suspendido" | "revocado";

export const PAYMENT_STATE_UI: Record<PaymentState, { label: string; cls: string }> = {
  pendiente_pago: { label: "Pendiente de pago", cls: "badge-info" },
  en_verificacion: { label: "Pago en verificación", cls: "badge-warn" },
  al_dia: { label: "Al día", cls: "badge-ok" },
  por_vencer: { label: "Próximo a vencer", cls: "badge-warn" },
  vencido: { label: "Vencido", cls: "badge-err" },
};

export const ACCESS_STATUS_UI: Record<AccessStatus, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente de asignación", cls: "badge-warn" },
  enlace_guardado: { label: "Enlace guardado", cls: "badge-info" },
  habilitado: { label: "Acceso habilitado", cls: "badge-ok" },
  suspendido: { label: "Acceso suspendido", cls: "badge-err" },
  revocado: { label: "Acceso revocado", cls: "badge-err" },
};

export const isPaid = (p: PaymentState) => p === "al_dia" || p === "por_vencer";

/** «Pagaron, pero no tienen acceso»: pago vigente y acceso distinto de habilitado. */
export const needsAccess = (p: PaymentState, a: AccessStatus) => isPaid(p) && a !== "habilitado";

export interface ClientAccessMessage {
  tone: "ok" | "info" | "warn" | "err";
  text: string;
  /** Mostrar el botón «Acceder a LURIA» (solo con enlace entregado por el servidor). */
  showAccessButton: boolean;
  cta: { href: string; label: string } | null;
}

/** Mensajes del cliente según la combinación de estados (prompt maestro, sección 5). */
export function clientAccessMessage(payment: PaymentState, access: AccessStatus, hasLink: boolean): ClientAccessMessage {
  if (payment === "vencido")
    return { tone: "err", text: "Tu suscripción ha vencido. Renueva tu plan para continuar utilizando LURIA.", showAccessButton: false, cta: { href: "/compra", label: "Renovar suscripción" } };
  if (payment === "pendiente_pago")
    return { tone: "info", text: "Completa el pago de tu suscripción para habilitar tu acceso.", showAccessButton: false, cta: { href: "/compra", label: "Pagar suscripción" } };
  if (payment === "en_verificacion")
    return { tone: "warn", text: "Estamos verificando tu pago. Te avisaremos cuando se confirme; no es necesario pagar de nuevo.", showAccessButton: false, cta: null };
  // Pago al día o próximo a vencer
  if (access === "habilitado" && hasLink)
    return {
      tone: "ok",
      text: payment === "por_vencer"
        ? "Tu suscripción está activa y ya puedes utilizar LURIA. Vence en pocos días: renuévala para no perder el acceso."
        : "Tu suscripción está activa y ya puedes utilizar LURIA.",
      showAccessButton: true,
      cta: payment === "por_vencer" ? { href: "/compra", label: "Renovar" } : null,
    };
  if (access === "revocado")
    return { tone: "err", text: "Tu acceso a LURIA no está disponible. Escríbenos desde soporte para revisarlo.", showAccessButton: false, cta: { href: "/soporte", label: "Ir a soporte" } };
  return { tone: "info", text: "Tu pago ha sido confirmado. Estamos preparando tu acceso a LURIA. Te notificaremos cuando esté disponible.", showAccessButton: false, cta: null };
}

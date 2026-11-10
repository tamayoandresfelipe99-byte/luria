/**
 * Estados separados de: 1) pedido, 2) pago, 3) suscripción, 4) licencia técnica.
 * Las mismas reglas están implementadas en SQL (supabase/migrations/0003_functions.sql),
 * que es la autoridad transaccional en producción. Las pruebas cubren ambas.
 */

export type OrderStatus = "pending_payment" | "paid" | "expired" | "cancelled" | "failed" | "refunded";

export type PaymentStatus =
  | "pending"
  | "approved"
  | "declined"
  | "voided"
  | "error"
  | "refunded"
  | "reversed";

export type SubscriptionStatus =
  | "pending_activation" // pagada, licencia aún no confirmada
  | "active"
  | "activation_failed"
  | "expired"
  | "revoked"; // reembolso o reversión confirmados

export type LicenseStatus = "requested" | "active" | "expired" | "revoked" | "failed";

const PAYMENT_RANK: Record<PaymentStatus, number> = {
  pending: 0,
  approved: 1,
  declined: 1,
  voided: 1,
  error: 1,
  refunded: 2,
  reversed: 2,
};

export type TransitionDecision =
  | { action: "apply" }
  | { action: "noop"; reason: "same_state" | "stale_event" }
  | { action: "conflict"; reason: string };

/**
 * Decide si un nuevo estado de pago se aplica.
 * - Eventos repetidos → noop.
 * - Eventos atrasados (p. ej. PENDING después de APPROVED) → noop (A07).
 * - Dos estados finales distintos (APPROVED vs DECLINED) → conflicto para revisión humana.
 * - Reembolso/reversión solo desde aprobado.
 */
export function decidePaymentTransition(
  current: PaymentStatus | null,
  incoming: PaymentStatus,
): TransitionDecision {
  if (current === null) return { action: "apply" };
  if (current === incoming) return { action: "noop", reason: "same_state" };
  const rc = PAYMENT_RANK[current];
  const ri = PAYMENT_RANK[incoming];
  if (ri < rc) return { action: "noop", reason: "stale_event" };
  if (ri === rc) return { action: "conflict", reason: `estado final contradictorio ${current} → ${incoming}` };
  if (ri === 2 && current !== "approved") {
    return { action: "conflict", reason: `${incoming} sobre un pago no aprobado (${current})` };
  }
  return { action: "apply" };
}

export function orderStatusForPayment(p: PaymentStatus): OrderStatus {
  switch (p) {
    case "approved":
      return "paid";
    case "declined":
    case "voided":
    case "error":
      return "failed";
    case "refunded":
    case "reversed":
      return "refunded";
    default:
      return "pending_payment";
  }
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  declined: "Rechazado",
  voided: "Anulado",
  error: "Error",
  refunded: "Reembolsado",
  reversed: "Reversado",
};

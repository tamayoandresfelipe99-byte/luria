import type { LicenseStatus, PaymentStatus, SubscriptionStatus } from "./states";
import { daysUntil } from "./time";

/**
 * ACCESO A LA EXTENSIÓN
 * El acceso lo concede únicamente un permiso técnico vigente (licencia activa y no vencida).
 * Una cuenta, un pedido, un comprobante o una URL de retorno NO conceden acceso (A01, A08).
 */
export interface LicenseView {
  status: LicenseStatus;
  validUntil: Date | null;
}

export function hasExtensionAccess(license: LicenseView | null | undefined, now: Date): boolean {
  if (!license) return false;
  if (license.status !== "active") return false;
  if (!license.validUntil) return false;
  return license.validUntil.getTime() > now.getTime();
}

/** Estado que ve el cliente en /cuenta. */
export type CustomerState =
  | "sin_suscripcion"
  | "pago_pendiente"
  | "pago_rechazado"
  | "activacion_pendiente"
  | "activacion_fallida"
  | "activa"
  | "por_vencer"
  | "cancelada_al_final"
  | "vencida"
  | "revocada";

export interface CustomerSnapshot {
  lastPaymentStatus: PaymentStatus | null;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  license: LicenseView | null;
}

export const RENEWAL_NOTICE_DAYS = 5;

export function customerState(s: CustomerSnapshot, now: Date): CustomerState {
  const sub = s.subscription;
  if (!sub) {
    if (s.lastPaymentStatus === "pending") return "pago_pendiente";
    if (s.lastPaymentStatus && ["declined", "voided", "error"].includes(s.lastPaymentStatus)) return "pago_rechazado";
    return "sin_suscripcion";
  }
  if (sub.status === "revoked") return "revocada";
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now.getTime()) return "vencida";
  if (sub.status === "expired") return "vencida";
  if (sub.status === "pending_activation") return "activacion_pendiente";
  if (sub.status === "activation_failed") return "activacion_fallida";
  if (!hasExtensionAccess(s.license, now)) return "activacion_pendiente";
  if (sub.cancelAtPeriodEnd) return "cancelada_al_final";
  if (sub.currentPeriodEnd && daysUntil(sub.currentPeriodEnd, now) <= RENEWAL_NOTICE_DAYS) return "por_vencer";
  return "activa";
}

/**
 * COMPUERTA DE COMPRA (A15, A20)
 * Una compra solo procede si el usuario confirmó requisitos de compatibilidad verificados,
 * aceptó términos y, para cobros reales, la operación está lista para producción.
 */
export interface PurchaseContext {
  authenticated: boolean;
  acceptedTerms: boolean;
  eligibility: "verified" | "unverified" | "incompatible" | "unknown";
  acknowledgedDesktopRequirement: boolean;
  realChargesEnabled: boolean;
  simulationAllowed: boolean;
  hasActiveFuturePeriod: boolean;
}

export function purchaseGate(c: PurchaseContext): { allowed: boolean; simulated: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!c.authenticated) reasons.push("Debes iniciar sesión para comprar.");
  if (!c.acceptedTerms) reasons.push("Debes aceptar los términos y condiciones de compra.");
  if (c.eligibility === "incompatible") reasons.push("Tu entorno no es compatible con LURIA. No es posible comprar.");
  else if (c.eligibility !== "verified") reasons.push("Primero verifica que tu entorno está entre los entornos compatibles verificados.");
  if (!c.acknowledgedDesktopRequirement) reasons.push("Debes confirmar que usarás Google Chrome en un computador de escritorio o portátil.");
  if (c.hasActiveFuturePeriod) reasons.push("Ya tienes un período pagado que aún no inicia; espera a que comience para volver a renovar.");
  const simulated = !c.realChargesEnabled && c.simulationAllowed;
  if (!c.realChargesEnabled && !c.simulationAllowed) reasons.push("Los pagos en línea aún no están habilitados.");
  return { allowed: reasons.length === 0, simulated, reasons };
}

/**
 * VIGENCIA SIN CONEXIÓN (A22)
 * Un token de licencia nunca puede durar más allá de la vigencia pagada.
 */
export function offlineTokenExpiry(validUntil: Date | null, now: Date, ttlMs: number): Date | null {
  if (!validUntil || validUntil.getTime() <= now.getTime()) return null;
  return new Date(Math.min(validUntil.getTime(), now.getTime() + ttlMs));
}

/** CONSENTIMIENTO COMERCIAL (A02, A18): manda el registro más reciente; por defecto no. */
export interface ConsentRecord {
  purpose: "marketing" | "analytics" | "terms" | "privacy";
  granted: boolean;
  at: Date;
}

export function canSendMarketing(records: ConsentRecord[]): boolean {
  const mk = records.filter((r) => r.purpose === "marketing").sort((a, b) => b.at.getTime() - a.at.getTime());
  return mk.length > 0 && mk[0]!.granted;
}

import type { LicenseAdapter } from "../licensing/types";
import type { PaymentProvider, VerifiedTransaction } from "../payments/types";
import { PaymentProviderError } from "../payments/types";
import type { PaymentStatus, SubscriptionStatus } from "../domain/states";

/**
 * PROCESADOR DE EVENTOS DE PAGO
 *
 *   firma válida → deduplicación → consulta al proveedor (fuente de verdad) → pedido →
 *   validación de importe/moneda → transición de estado (atómica, en SQL) → licencia → tarea si falla
 *
 * Nunca se usa como autoridad: la URL de retorno, el navegador, WhatsApp ni el CRM.
 */

export type EventFinalStatus = "processed" | "ignored" | "rejected" | "review" | "error";

export interface OrderRow {
  id: string;
  userId: string;
  reference: string;
  amountCop: number;
  currency: string;
}

export interface ApplyPaymentResult {
  outcome: "applied" | "noop" | "conflict" | "amount_mismatch";
  paymentId: string;
  paymentStatus: PaymentStatus;
  /** Presente cuando el pago aprobado abrió o extendió una vigencia. */
  period?: { subscriptionId: string; userId: string; periodEnd: Date; subscriptionStatus: SubscriptionStatus };
  /** Presente cuando un reembolso/reversión exige revocar la licencia. */
  revoke?: { subscriptionId: string; externalLicenseId: string | null };
}

export interface PaymentRepo {
  recordEvent(e: {
    provider: string;
    dedupeKey: string;
    eventType: string;
    transactionId: string | null;
    signatureValid: boolean;
    receivedAt: Date;
  }): Promise<{ eventId: string; duplicate: boolean; previousStatus: EventFinalStatus | "received" | null }>;
  finishEvent(eventId: string, status: EventFinalStatus, note?: string): Promise<void>;
  findOrderByReference(reference: string): Promise<OrderRow | null>;
  /** Atómico e idempotente (en producción: función SQL fn_apply_payment). */
  applyPayment(input: { order: OrderRow; tx: VerifiedTransaction; verifiedAt: Date }): Promise<ApplyPaymentResult>;
  markLicenseActive(i: { subscriptionId: string; externalLicenseId: string; validUntil: Date; at: Date }): Promise<void>;
  markLicenseRevoked(i: { subscriptionId: string; at: Date }): Promise<void>;
  /** Idempotente por (paymentId, kind). */
  upsertActivationTask(i: {
    paymentId: string;
    subscriptionId: string;
    kind: "activation" | "revocation";
    errorCode: string;
    errorMessage: string;
    at: Date;
  }): Promise<void>;
  externalUserRef(userId: string): Promise<string>;
}

export interface ProcessDeps {
  provider: PaymentProvider;
  repo: PaymentRepo;
  licenses: LicenseAdapter;
  now: () => Date;
  /**
   * ¿Registrar este rechazo? Limita cuántos eventos falsos puede escribir un mismo origen en la base de datos
   * (sin límite, cualquiera podría llenar payment_events con firmas inválidas). Por defecto, siempre.
   */
  allowRejectedRecord?: () => Promise<boolean>;
}

export interface ProcessResult {
  httpStatus: number;
  outcome: string;
}

const TERMINAL: (EventFinalStatus | "received" | null)[] = ["processed", "ignored", "rejected", "review"];

export async function processPaymentWebhook(deps: ProcessDeps, rawBody: string, headers: Headers): Promise<ProcessResult> {
  const { provider, repo, licenses, now } = deps;
  const verification = await provider.verifyWebhook(rawBody, headers, now());

  if (!verification.ok) {
    // A06: eventos falsos o alterados se rechazan y no se procesan. El registro es auditoría, no condición:
    // si está limitado o falla, el rechazo se mantiene.
    if (await (deps.allowRejectedRecord?.() ?? Promise.resolve(true))) {
      await repo
        .recordEvent({
          provider: provider.id,
          dedupeKey: `rejected:${verification.reason}:${crypto.randomUUID()}`,
          eventType: "unverified",
          transactionId: null,
          signatureValid: false,
          receivedAt: now(),
        })
        .then((r) => repo.finishEvent(r.eventId, "rejected", verification.reason))
        .catch(() => undefined);
    }
    const status = verification.reason === "unsupported_event" ? 200 : 401;
    return { httpStatus: status, outcome: `rejected:${verification.reason}` };
  }

  const ev = verification.event;
  const rec = await repo.recordEvent({
    provider: ev.provider,
    dedupeKey: ev.dedupeKey,
    eventType: ev.eventType,
    transactionId: ev.transactionId,
    signatureValid: true,
    receivedAt: now(),
  });
  // A05: evento duplicado ya procesado → sin efectos.
  if (rec.duplicate && TERMINAL.includes(rec.previousStatus)) return { httpStatus: 200, outcome: "duplicate" };

  let tx: VerifiedTransaction;
  try {
    tx = await provider.fetchTransaction(ev.transactionId);
  } catch (e) {
    const retryable = e instanceof PaymentProviderError ? e.retryable : true;
    await repo.finishEvent(rec.eventId, retryable ? "error" : "review", "No se pudo confirmar con el proveedor");
    return { httpStatus: retryable ? 503 : 200, outcome: "provider_unavailable" };
  }

  const order = await repo.findOrderByReference(tx.reference);
  if (!order) {
    await repo.finishEvent(rec.eventId, "review", `Pedido inexistente para referencia ${tx.reference}`);
    return { httpStatus: 200, outcome: "orphan" };
  }

  const applied = await repo.applyPayment({ order, tx, verifiedAt: now() });

  if (applied.outcome === "amount_mismatch") {
    // A04: importe o moneda distintos al pedido → no se habilita nada; revisión humana.
    await repo.finishEvent(rec.eventId, "review", "Importe o moneda no coinciden con el pedido");
    return { httpStatus: 200, outcome: "amount_mismatch" };
  }
  if (applied.outcome === "conflict") {
    await repo.finishEvent(rec.eventId, "review", "Transición de estado contradictoria");
    return { httpStatus: 200, outcome: "conflict" };
  }
  if (applied.outcome === "noop") {
    await repo.finishEvent(rec.eventId, "ignored", "Sin cambio de estado");
    return { httpStatus: 200, outcome: "noop" };
  }

  if (applied.period) {
    const p = applied.period;
    const res = await licenses.grant({
      userId: p.userId,
      externalUserRef: await repo.externalUserRef(p.userId),
      subscriptionId: p.subscriptionId,
      validUntil: p.periodEnd,
      idempotencyKey: `grant:${applied.paymentId}`,
    });
    if (res.ok) {
      await repo.markLicenseActive({ subscriptionId: p.subscriptionId, externalLicenseId: res.externalLicenseId, validUntil: p.periodEnd, at: now() });
    } else {
      // A09: pago aprobado + fallo de licencia → tarea auditable; el cliente ve "activación pendiente".
      await repo.upsertActivationTask({
        paymentId: applied.paymentId,
        subscriptionId: p.subscriptionId,
        kind: "activation",
        errorCode: res.code,
        errorMessage: res.message,
        at: now(),
      });
    }
  }

  if (applied.revoke) {
    const r = applied.revoke;
    const res = r.externalLicenseId
      ? await licenses.revoke({
          externalLicenseId: r.externalLicenseId,
          reason: applied.paymentStatus === "reversed" ? "chargeback" : "refund",
          idempotencyKey: `revoke:${applied.paymentId}`,
        })
      : null;
    if (res?.ok) await repo.markLicenseRevoked({ subscriptionId: r.subscriptionId, at: now() });
    else if (r.externalLicenseId)
      await repo.upsertActivationTask({
        paymentId: applied.paymentId,
        subscriptionId: r.subscriptionId,
        kind: "revocation",
        errorCode: res && !res.ok ? res.code : "UNKNOWN",
        errorMessage: res && !res.ok ? res.message : "Revocación no confirmada",
        at: now(),
      });
  }

  await repo.finishEvent(rec.eventId, "processed");
  return { httpStatus: 200, outcome: `applied:${applied.paymentStatus}` };
}

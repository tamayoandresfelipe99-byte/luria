import { randomUUID } from "node:crypto";
import { computeNextPeriod } from "../domain/time";
import { decidePaymentTransition, orderStatusForPayment, type OrderStatus, type PaymentStatus, type SubscriptionStatus, type LicenseStatus } from "../domain/states";
import type { ApplyPaymentResult, EventFinalStatus, OrderRow, PaymentRepo } from "./payment-processor";
import type { VerifiedTransaction } from "../payments/types";

/**
 * Repositorio en memoria. USO: pruebas automatizadas y desarrollo local sin base de datos.
 * Replica las reglas de la función SQL fn_apply_payment (autoridad en producción).
 */
export class MemoryRepo implements PaymentRepo {
  events = new Map<string, { id: string; status: EventFinalStatus | "received"; note?: string; signatureValid: boolean }>();
  orders = new Map<string, OrderRow & { status: OrderStatus }>();
  payments = new Map<string, { id: string; orderId: string; provider: string; txId: string; status: PaymentStatus; amountInCents: number; discrepancy: boolean }>();
  subscriptions = new Map<string, {
    id: string;
    userId: string;
    status: SubscriptionStatus;
    anchorDay: number | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  }>();
  periods = new Map<string, { paymentId: string; subscriptionId: string; start: Date; end: Date; refunded: boolean }>();
  licenses = new Map<string, { subscriptionId: string; externalLicenseId: string | null; status: LicenseStatus; validUntil: Date | null }>();
  tasks = new Map<string, { paymentId: string; subscriptionId: string; kind: string; attempts: number; errorCode: string; status: "open" | "done" }>();
  commissions = new Map<string, { paymentId: string; amountCop: number }>();
  audit: { action: string; objectId: string; at: Date }[] = [];

  addOrder(o: OrderRow): void {
    this.orders.set(o.id, { ...o, status: "pending_payment" });
  }

  async recordEvent(e: Parameters<PaymentRepo["recordEvent"]>[0]) {
    const existing = this.events.get(e.dedupeKey);
    if (existing) return { eventId: existing.id, duplicate: true, previousStatus: existing.status };
    const id = randomUUID();
    this.events.set(e.dedupeKey, { id, status: "received", signatureValid: e.signatureValid });
    return { eventId: id, duplicate: false, previousStatus: null };
  }

  async finishEvent(eventId: string, status: EventFinalStatus, note?: string) {
    for (const ev of this.events.values()) if (ev.id === eventId) Object.assign(ev, { status, note });
  }

  async findOrderByReference(reference: string) {
    for (const o of this.orders.values()) if (o.reference === reference) return o;
    return null;
  }

  async applyPayment({ order, tx, verifiedAt }: { order: OrderRow; tx: VerifiedTransaction; verifiedAt: Date }): Promise<ApplyPaymentResult> {
    const key = `${tx.provider}:${tx.transactionId}`;
    let pay = this.payments.get(key);
    if (tx.amountInCents !== order.amountCop * 100 || tx.currency !== order.currency) {
      if (!pay) {
        pay = { id: randomUUID(), orderId: order.id, provider: tx.provider, txId: tx.transactionId, status: tx.status, amountInCents: tx.amountInCents, discrepancy: true };
        this.payments.set(key, pay);
      }
      pay.discrepancy = true;
      return { outcome: "amount_mismatch", paymentId: pay.id, paymentStatus: pay.status };
    }
    const decision = decidePaymentTransition(pay?.status ?? null, tx.status);
    if (decision.action === "noop") return { outcome: "noop", paymentId: pay!.id, paymentStatus: pay!.status };
    if (decision.action === "conflict") return { outcome: "conflict", paymentId: pay!.id, paymentStatus: pay!.status };

    if (!pay) {
      pay = { id: randomUUID(), orderId: order.id, provider: tx.provider, txId: tx.transactionId, status: tx.status, amountInCents: tx.amountInCents, discrepancy: false };
      this.payments.set(key, pay);
    }
    pay.status = tx.status;
    const ord = this.orders.get(order.id)!;
    ord.status = orderStatusForPayment(tx.status);
    this.audit.push({ action: `payment.${tx.status}`, objectId: pay.id, at: verifiedAt });

    const result: ApplyPaymentResult = { outcome: "applied", paymentId: pay.id, paymentStatus: pay.status };

    if (tx.status === "approved" && !this.periods.has(pay.id)) {
      let sub = [...this.subscriptions.values()].find((s) => s.userId === order.userId);
      if (!sub) {
        sub = { id: randomUUID(), userId: order.userId, status: "pending_activation", anchorDay: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
        this.subscriptions.set(sub.id, sub);
      }
      const continuing = sub.status !== "revoked" && sub.status !== "expired";
      const period = computeNextPeriod({
        paidAt: tx.finalizedAt ?? verifiedAt,
        currentEnd: continuing ? sub.currentPeriodEnd : null,
        anchorDay: continuing ? sub.anchorDay : null,
      });
      this.periods.set(pay.id, { paymentId: pay.id, subscriptionId: sub.id, start: period.start, end: period.end, refunded: false });
      sub.currentPeriodEnd = period.end;
      sub.anchorDay = period.anchorDay;
      sub.cancelAtPeriodEnd = false;
      if (sub.status !== "active") sub.status = "pending_activation";
      if (!this.licenses.has(sub.id)) this.licenses.set(sub.id, { subscriptionId: sub.id, externalLicenseId: null, status: "requested", validUntil: null });
      if (!this.commissions.has(pay.id)) this.commissions.set(pay.id, { paymentId: pay.id, amountCop: order.amountCop });
      result.period = { subscriptionId: sub.id, userId: sub.userId, periodEnd: period.end, subscriptionStatus: sub.status };
    }

    if (tx.status === "refunded" || tx.status === "reversed") {
      const per = this.periods.get(pay.id);
      if (per && !per.refunded) {
        per.refunded = true;
        const sub = this.subscriptions.get(per.subscriptionId)!;
        sub.status = "revoked";
        const lic = this.licenses.get(sub.id);
        this.commissions.delete(pay.id);
        result.revoke = { subscriptionId: sub.id, externalLicenseId: lic?.externalLicenseId ?? null };
      }
    }
    return result;
  }

  async markLicenseActive(i: { subscriptionId: string; externalLicenseId: string; validUntil: Date; at: Date }) {
    this.licenses.set(i.subscriptionId, { subscriptionId: i.subscriptionId, externalLicenseId: i.externalLicenseId, status: "active", validUntil: i.validUntil });
    const sub = this.subscriptions.get(i.subscriptionId)!;
    if (sub.status !== "revoked") sub.status = "active";
    for (const t of this.tasks.values()) if (t.subscriptionId === i.subscriptionId && t.kind === "activation") t.status = "done";
  }

  async markLicenseRevoked(i: { subscriptionId: string; at: Date }) {
    const lic = this.licenses.get(i.subscriptionId);
    if (lic) lic.status = "revoked";
  }

  async upsertActivationTask(i: { paymentId: string; subscriptionId: string; kind: "activation" | "revocation"; errorCode: string; errorMessage: string; at: Date }) {
    const key = `${i.paymentId}:${i.kind}`;
    const t = this.tasks.get(key);
    if (t) {
      t.attempts += 1;
      t.errorCode = i.errorCode;
    } else this.tasks.set(key, { paymentId: i.paymentId, subscriptionId: i.subscriptionId, kind: i.kind, attempts: 1, errorCode: i.errorCode, status: "open" });
    if (i.kind === "activation") {
      const sub = this.subscriptions.get(i.subscriptionId);
      if (sub && sub.status === "pending_activation" && i.errorCode !== "LICENSE_ADAPTER_PENDING" && i.errorCode !== "MANUAL_ACTION_REQUIRED") {
        sub.status = "activation_failed";
      }
    }
  }

  async externalUserRef(userId: string) {
    return `usr_${userId}`;
  }
}

import "server-only";
import { supabaseAdmin } from "./admin";
import type { ApplyPaymentResult, EventFinalStatus, OrderRow, PaymentRepo } from "../services/payment-processor";
import type { VerifiedTransaction } from "../payments/types";
import type { PaymentStatus, SubscriptionStatus } from "../domain/states";

/**
 * Implementación de PaymentRepo sobre Supabase. Toda transición pasa por funciones SQL
 * transaccionales (supabase/migrations/20261110000300_functions.sql).
 */
export class SupabasePaymentRepo implements PaymentRepo {
  constructor(private readonly slaHours: number | null) {}

  private get db() {
    return supabaseAdmin();
  }

  async recordEvent(e: Parameters<PaymentRepo["recordEvent"]>[0]) {
    const { data, error } = await this.db.rpc("fn_record_event", {
      p_provider: e.provider,
      p_dedupe_key: e.dedupeKey,
      p_event_type: e.eventType,
      p_tx_id: e.transactionId,
      p_signature_valid: e.signatureValid,
    });
    if (error) throw error;
    const row = (data as { event_id: string; duplicate: boolean; previous_status: EventFinalStatus | "received" }[])[0]!;
    return { eventId: row.event_id, duplicate: row.duplicate, previousStatus: row.duplicate ? row.previous_status : null };
  }

  async finishEvent(eventId: string, status: EventFinalStatus, note?: string) {
    const { error } = await this.db.rpc("fn_finish_event", { p_event_id: eventId, p_status: status, p_note: note ?? null });
    if (error) throw error;
  }

  async findOrderByReference(reference: string): Promise<OrderRow | null> {
    const { data, error } = await this.db
      .from("orders")
      .select("id, user_id, reference, amount_cop, currency")
      .eq("reference", reference)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const d = data as { id: string; user_id: string; reference: string; amount_cop: number; currency: string };
    return { id: d.id, userId: d.user_id, reference: d.reference, amountCop: d.amount_cop, currency: d.currency };
  }

  async applyPayment({ order, tx }: { order: OrderRow; tx: VerifiedTransaction; verifiedAt: Date }): Promise<ApplyPaymentResult> {
    const { data, error } = await this.db.rpc("fn_apply_payment", {
      p_order_id: order.id,
      p_provider: tx.provider,
      p_tx_id: tx.transactionId,
      p_amount_cents: tx.amountInCents,
      p_currency: tx.currency,
      p_status: tx.status,
      p_method: tx.paymentMethodType,
      p_paid_at: (tx.finalizedAt ?? new Date()).toISOString(),
    });
    if (error) throw error;
    const r = data as {
      outcome: ApplyPaymentResult["outcome"];
      payment_id: string;
      payment_status: PaymentStatus;
      period?: { subscription_id: string; user_id: string; period_end: string; subscription_status: SubscriptionStatus };
      revoke?: { subscription_id: string; external_license_id: string | null };
    };
    return {
      outcome: r.outcome,
      paymentId: r.payment_id,
      paymentStatus: r.payment_status,
      period: r.period && {
        subscriptionId: r.period.subscription_id,
        userId: r.period.user_id,
        periodEnd: new Date(r.period.period_end),
        subscriptionStatus: r.period.subscription_status,
      },
      revoke: r.revoke && { subscriptionId: r.revoke.subscription_id, externalLicenseId: r.revoke.external_license_id },
    };
  }

  async markLicenseActive(i: { subscriptionId: string; externalLicenseId: string; validUntil: Date }) {
    const { error } = await this.db.rpc("fn_mark_license_active", {
      p_subscription_id: i.subscriptionId,
      p_external_license_id: i.externalLicenseId,
      p_valid_until: i.validUntil.toISOString(),
    });
    if (error) throw error;
  }

  async markLicenseRevoked(i: { subscriptionId: string }) {
    const { error } = await this.db.rpc("fn_mark_license_revoked", { p_subscription_id: i.subscriptionId });
    if (error) throw error;
  }

  async upsertActivationTask(i: { paymentId: string; subscriptionId: string; kind: "activation" | "revocation"; errorCode: string; errorMessage: string }) {
    const { error } = await this.db.rpc("fn_upsert_activation_task", {
      p_payment_id: i.paymentId,
      p_subscription_id: i.subscriptionId,
      p_kind: i.kind,
      p_error_code: i.errorCode,
      p_error_message: i.errorMessage,
      p_sla_hours: this.slaHours,
    });
    if (error) throw error;
  }

  async externalUserRef(userId: string) {
    const { data, error } = await this.db.from("profiles").select("external_ref").eq("id", userId).single();
    if (error) throw error;
    return (data as { external_ref: string }).external_ref;
  }
}

import { createMockProvider, buildSignedEvent, type MockPaymentProvider } from "../src/lib/payments/mock";
import { MemoryRepo } from "../src/lib/services/memory-repo";
import { processPaymentWebhook } from "../src/lib/services/payment-processor";
import type { LicenseAdapter } from "../src/lib/licensing/types";
import { createSimulatedAdapter } from "../src/lib/licensing/adapters";
import type { PaymentStatus } from "../src/lib/domain/states";

export const WOMPI_STATUS: Record<PaymentStatus, string> = {
  pending: "PENDING",
  approved: "APPROVED",
  declined: "DECLINED",
  voided: "VOIDED",
  error: "ERROR",
  refunded: "REFUNDED",
  reversed: "REVERSED",
};

export function setup(opts: { licenses?: LicenseAdapter; now?: Date } = {}) {
  const provider: MockPaymentProvider = createMockProvider("http://localhost:3000");
  const repo = new MemoryRepo();
  let now = opts.now ?? new Date("2026-11-10T15:00:00Z");
  const licenses = opts.licenses ?? createSimulatedAdapter();
  const deps = { provider, repo, licenses, now: () => now };
  repo.addOrder({ id: "o1", userId: "u1", reference: "LUR-20261110-ABCDEFGHIJ", amountCop: 40000, currency: "COP" });

  /** Simula que el proveedor tiene la transacción en este estado y envía el evento firmado. */
  async function send(txId: string, status: PaymentStatus, o: { amountCents?: number; claimed?: string; reference?: string } = {}) {
    const reference = o.reference ?? "LUR-20261110-ABCDEFGHIJ";
    const amount = o.amountCents ?? 4_000_000;
    // El proveedor (fuente de verdad) responde con el estado real:
    provider.store.set(txId, {
      provider: "mock",
      transactionId: txId,
      reference,
      amountInCents: amount,
      currency: "COP",
      status,
      paymentMethodType: "NEQUI",
      finalizedAt: now,
    });
    // Los estados REFUNDED/REVERSED no existen en eventos Wompi; se envía el último estado firmado.
    const claimed = o.claimed ?? (status === "refunded" || status === "reversed" ? "VOIDED" : WOMPI_STATUS[status]);
    const body = buildSignedEvent({ id: txId, reference, status: claimed, amount_in_cents: amount }, Math.floor(now.getTime() / 1000));
    return processPaymentWebhook(deps, body, new Headers());
  }

  return {
    provider,
    repo,
    deps,
    send,
    setNow: (d: Date) => {
      now = d;
    },
  };
}

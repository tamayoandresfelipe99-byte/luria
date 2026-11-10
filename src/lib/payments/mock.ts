import { createHash } from "node:crypto";
import { PaymentProviderError, type PaymentProvider, type VerifiedTransaction } from "./types";
import { computeEventChecksum, createWompiProvider } from "./wompi";

/**
 * PROVEEDOR SIMULADO — SOLO DESARROLLO Y PRUEBAS.
 * Usa el mismo formato de eventos firmados de Wompi para que el flujo sea idéntico,
 * pero ninguna transacción es real. `assertSafeConfig` impide su uso en producción (A20).
 * En modo simulado, el servicio de licencias también es simulado: nunca se entrega acceso real.
 */
export const MOCK_EVENTS_SECRET = "dev_only_mock_events_secret";

export interface MockPaymentProvider extends PaymentProvider {
  /** Transacciones simuladas en memoria (válido solo en `next dev`, un único proceso). */
  store: Map<string, VerifiedTransaction>;
}

export function createMockProvider(appUrl: string): MockPaymentProvider {
  const base = createWompiProvider({
    environment: "sandbox",
    publicKey: "pub_mock",
    integritySecret: "dev_only_mock_integrity",
    eventsSecret: MOCK_EVENTS_SECRET,
  });
  const store = new Map<string, VerifiedTransaction>();
  return {
    id: "mock",
    simulated: true,
    store,
    async createCheckout(order) {
      const url = new URL("/compra/simulador", appUrl);
      url.searchParams.set("referencia", order.reference);
      return { provider: "mock", url: url.toString(), simulated: true };
    },
    verifyWebhook: base.verifyWebhook,
    async fetchTransaction(id) {
      const tx = store.get(id);
      if (!tx) throw new PaymentProviderError("Transacción simulada desconocida", false);
      return tx;
    },
  };
}

/** Construye un evento firmado con el formato de Wompi (para el simulador y las pruebas). */
export function buildSignedEvent(
  tx: { id: string; reference: string; status: string; amount_in_cents: number },
  timestampSec: number,
  secret = MOCK_EVENTS_SECRET,
): string {
  const data = { transaction: { ...tx, currency: "COP" } };
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const checksum = computeEventChecksum(data, properties, timestampSec, secret);
  return JSON.stringify({
    event: "transaction.updated",
    data,
    environment: "test",
    signature: { properties, checksum },
    timestamp: timestampSec,
    sent_at: new Date(timestampSec * 1000).toISOString(),
  });
}

export function fakeTxId(seed: string): string {
  return "SIM-" + createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

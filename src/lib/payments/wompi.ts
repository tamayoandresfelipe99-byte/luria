import { createHash, timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "../domain/states";
import { copToCents } from "../domain/money";
import {
  PaymentProviderError,
  type CheckoutSession,
  type OrderForCheckout,
  type ParsedEvent,
  type PaymentProvider,
  type VerifiedTransaction,
  type WebhookVerification,
} from "./types";

/**
 * Adaptador Wompi (Colombia).
 * Referencias (verificadas el 10-nov-2026):
 *  - Eventos: https://docs.wompi.co/en/docs/colombia/eventos/
 *    checksum = SHA256( valores de signature.properties en orden + timestamp + secreto de eventos )
 *    Se envía en el cuerpo (signature.checksum) y en el encabezado X-Event-Checksum.
 *    Reintentos: hasta 3 en 24 h si no se responde HTTP 200.
 *  - Web Checkout con firma de integridad: SHA256(referencia + monto_en_centavos + moneda + secreto_integridad).
 *  - Consulta de transacción: GET {API}/transactions/{id} (llave pública).
 *
 * Toda credencial se lee en el servidor. Nada de esto se importa desde componentes cliente.
 */

export interface WompiConfig {
  environment: "sandbox" | "production";
  publicKey: string;
  integritySecret: string;
  eventsSecret: string;
  /** Inyectable para pruebas. */
  fetchImpl?: typeof fetch;
  /** Antigüedad máxima aceptada de un evento (Wompi reintenta hasta 24 h). */
  maxEventAgeSeconds?: number;
}

const API_BASE = {
  sandbox: "https://sandbox.wompi.co/v1",
  production: "https://production.wompi.co/v1",
} as const;

const CHECKOUT_URL = "https://checkout.wompi.co/p/";

export function mapWompiStatus(s: string): PaymentStatus {
  switch (s) {
    case "APPROVED":
      return "approved";
    case "DECLINED":
      return "declined";
    case "VOIDED":
      return "voided";
    case "ERROR":
      return "error";
    case "PENDING":
      return "pending";
    default:
      throw new PaymentProviderError(`Estado Wompi desconocido: ${s}`, false);
  }
}

export function integritySignature(reference: string, amountInCents: number, currency: string, secret: string): string {
  return createHash("sha256").update(`${reference}${amountInCents}${currency}${secret}`).digest("hex");
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

export function computeEventChecksum(data: unknown, properties: string[], timestamp: number, secret: string): string {
  const concatenated = properties.map((p) => {
    const v = getPath(data, p);
    if (v === undefined || v === null) throw new Error(`Propiedad firmada ausente: ${p}`);
    return String(v);
  });
  return createHash("sha256").update(`${concatenated.join("")}${timestamp}${secret}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a.toLowerCase(), "utf8");
  const y = Buffer.from(b.toLowerCase(), "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createWompiProvider(cfg: WompiConfig): PaymentProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  const maxAge = cfg.maxEventAgeSeconds ?? 48 * 3600;

  return {
    id: "wompi",
    simulated: false,

    async createCheckout(order: OrderForCheckout): Promise<CheckoutSession> {
      const amountInCents = copToCents(order.amountCop);
      const params = new URLSearchParams({
        "public-key": cfg.publicKey,
        currency: order.currency,
        "amount-in-cents": String(amountInCents),
        reference: order.reference,
        "signature:integrity": integritySignature(order.reference, amountInCents, order.currency, cfg.integritySecret),
        "redirect-url": order.redirectUrl,
        "customer-data:email": order.customerEmail,
      });
      return { provider: "wompi", url: `${CHECKOUT_URL}?${params.toString()}`, simulated: false };
    },

    async verifyWebhook(rawBody: string, headers: Headers, now: Date): Promise<WebhookVerification> {
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return { ok: false, reason: "invalid_json" };
      }
      const b = body as {
        event?: string;
        data?: { transaction?: { id?: string; reference?: string; status?: string } };
        signature?: { properties?: string[]; checksum?: string };
        timestamp?: number;
      };
      const props = b.signature?.properties;
      const checksum = b.signature?.checksum;
      if (!Array.isArray(props) || props.length === 0 || typeof checksum !== "string" || typeof b.timestamp !== "number") {
        return { ok: false, reason: "missing_signature" };
      }
      let expected: string;
      try {
        expected = computeEventChecksum(b.data, props, b.timestamp, cfg.eventsSecret);
      } catch {
        return { ok: false, reason: "bad_signature" };
      }
      if (!safeEqualHex(expected, checksum)) return { ok: false, reason: "bad_signature" };
      const header = headers.get("x-event-checksum");
      if (header && !safeEqualHex(expected, header)) return { ok: false, reason: "bad_signature" };

      // Wompi documenta el timestamp en segundos UNIX; se aceptan milisegundos por robustez.
      const tsSeconds = b.timestamp > 1e12 ? Math.floor(b.timestamp / 1000) : b.timestamp;
      if (Math.abs(now.getTime() / 1000 - tsSeconds) > maxAge) return { ok: false, reason: "stale" };

      if (b.event !== "transaction.updated" || !b.data?.transaction?.id) {
        return { ok: false, reason: "unsupported_event" };
      }
      const tx = b.data.transaction;
      const event: ParsedEvent = {
        provider: "wompi",
        eventType: b.event,
        transactionId: String(tx.id),
        reference: tx.reference ?? null,
        claimedStatus: tx.status ? mapWompiStatus(tx.status) : null,
        eventTimestamp: tsSeconds,
        dedupeKey: createHash("sha256").update(`wompi|${b.event}|${tx.id}|${tx.status}|${b.timestamp}`).digest("hex"),
      };
      return { ok: true, event };
    },

    async fetchTransaction(transactionId: string): Promise<VerifiedTransaction> {
      const res = await doFetch(`${API_BASE[cfg.environment]}/transactions/${encodeURIComponent(transactionId)}`, {
        headers: { Authorization: `Bearer ${cfg.publicKey}` },
        cache: "no-store",
      });
      if (!res.ok) throw new PaymentProviderError(`Wompi respondió ${res.status}`, res.status >= 500 || res.status === 429);
      const json = (await res.json()) as {
        data?: {
          id: string;
          reference: string;
          amount_in_cents: number;
          currency: string;
          status: string;
          payment_method_type?: string;
          finalized_at?: string | null;
        };
      };
      const d = json.data;
      if (!d) throw new PaymentProviderError("Respuesta Wompi sin datos", true);
      return {
        provider: "wompi",
        transactionId: d.id,
        reference: d.reference,
        amountInCents: d.amount_in_cents,
        currency: d.currency,
        status: mapWompiStatus(d.status),
        paymentMethodType: d.payment_method_type ?? null,
        finalizedAt: d.finalized_at ? new Date(d.finalized_at) : null,
      };
    },
  };
}

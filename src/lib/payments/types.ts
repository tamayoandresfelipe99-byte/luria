import type { PaymentStatus } from "../domain/states";

export type ProviderId = "wompi" | "mercadopago" | "payu" | "mock";

export interface OrderForCheckout {
  reference: string;
  amountCop: number; // leído de la base de datos, nunca del navegador
  currency: "COP";
  customerEmail: string;
  redirectUrl: string;
}

export interface CheckoutSession {
  provider: ProviderId;
  /** URL a la que se redirige al comprador (checkout alojado por el proveedor). */
  url: string;
  simulated: boolean;
}

/** Evento recibido y con firma validada. Todavía NO es la verdad: se confirma consultando al proveedor. */
export interface ParsedEvent {
  provider: ProviderId;
  eventType: string;
  transactionId: string;
  reference: string | null;
  claimedStatus: PaymentStatus | null;
  eventTimestamp: number; // epoch segundos
  /** Clave de deduplicación estable para el evento. */
  dedupeKey: string;
}

export type WebhookVerification =
  | { ok: true; event: ParsedEvent }
  | { ok: false; reason: "invalid_json" | "missing_signature" | "bad_signature" | "stale" | "unsupported_event" };

/** Transacción confirmada directamente contra la API del proveedor (fuente de verdad). */
export interface VerifiedTransaction {
  provider: ProviderId;
  transactionId: string;
  reference: string;
  amountInCents: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodType: string | null;
  finalizedAt: Date | null;
}

export interface PaymentProvider {
  id: ProviderId;
  simulated: boolean;
  createCheckout(order: OrderForCheckout): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, headers: Headers, now: Date): Promise<WebhookVerification>;
  fetchTransaction(transactionId: string): Promise<VerifiedTransaction>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

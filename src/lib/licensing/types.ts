/**
 * CONTRATO CONCEPTUAL DE INTEGRACIÓN DE LICENCIAS (ver docs/contrato-licencias.md)
 *
 * La web comercial NO inventa la API de la extensión. Define una interfaz con tres operaciones
 * (habilitar, revocar, consultar) que debe implementar el mecanismo real de la extensión.
 * Mientras ese mecanismo no exista, el adaptador "pending" deja cada activación como tarea operativa.
 */

export type LicenseAdapterMode = "pending" | "manual" | "http" | "simulated";

export interface GrantRequest {
  userId: string;
  /** Identificador estable del usuario ante la extensión (no es el correo). */
  externalUserRef: string;
  subscriptionId: string;
  validUntil: Date;
  idempotencyKey: string;
}

export interface RevokeRequest {
  externalLicenseId: string;
  reason: "refund" | "chargeback" | "expired" | "admin" | "fraud";
  idempotencyKey: string;
}

export type LicenseOpResult =
  | { ok: true; externalLicenseId: string; status: "active" | "revoked" | "expired"; validUntil: Date | null }
  | { ok: false; code: LicenseErrorCode; retryable: boolean; message: string };

export type LicenseErrorCode =
  | "LICENSE_ADAPTER_PENDING"
  | "MANUAL_ACTION_REQUIRED"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_REJECTED"
  | "TIMEOUT";

export interface LicenseAdapter {
  mode: LicenseAdapterMode;
  /** true si las licencias emitidas NO dan acceso real (desarrollo). */
  simulated: boolean;
  grant(req: GrantRequest): Promise<LicenseOpResult>;
  revoke(req: RevokeRequest): Promise<LicenseOpResult>;
  status(externalLicenseId: string): Promise<LicenseOpResult>;
}

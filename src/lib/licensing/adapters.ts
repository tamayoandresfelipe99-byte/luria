import { createHmac, randomUUID } from "node:crypto";
import type { GrantRequest, LicenseAdapter, LicenseOpResult, RevokeRequest } from "./types";

/** Estado actual: no existe API de licencias confirmada. Cada pago aprobado genera una tarea auditable. */
export function createPendingAdapter(): LicenseAdapter {
  const pending = async (): Promise<LicenseOpResult> => ({
    ok: false,
    code: "LICENSE_ADAPTER_PENDING",
    retryable: true,
    message: "La integración de licencias con la extensión aún no está disponible.",
  });
  return { mode: "pending", simulated: false, grant: pending, revoke: pending, status: pending };
}

/**
 * Activación manual auditada. Solo se permite si el producto tiene un mecanismo REAL
 * para controlar vigencia y revocar (config LICENSE_MANUAL_REVOCATION_CONFIRMED=true).
 * La operación técnica la realiza una persona; la web registra la tarea, el responsable y la evidencia.
 */
export function createManualAdapter(): LicenseAdapter {
  const manual = async (): Promise<LicenseOpResult> => ({
    ok: false,
    code: "MANUAL_ACTION_REQUIRED",
    retryable: false,
    message: "Requiere acción del equipo de operaciones en el sistema de la extensión.",
  });
  return { mode: "manual", simulated: false, grant: manual, revoke: manual, status: manual };
}

/** SOLO DESARROLLO: emite licencias ficticias que no dan acceso a la extensión real. */
export function createSimulatedAdapter(): LicenseAdapter {
  const db = new Map<string, { status: "active" | "revoked"; validUntil: Date }>();
  return {
    mode: "simulated",
    simulated: true,
    async grant(req) {
      const id = `SIM-LIC-${req.subscriptionId}`;
      db.set(id, { status: "active", validUntil: req.validUntil });
      return { ok: true, externalLicenseId: id, status: "active", validUntil: req.validUntil };
    },
    async revoke(req) {
      const cur = db.get(req.externalLicenseId);
      if (cur) cur.status = "revoked";
      return { ok: true, externalLicenseId: req.externalLicenseId, status: "revoked", validUntil: cur?.validUntil ?? null };
    },
    async status(id) {
      const cur = db.get(id);
      if (!cur) return { ok: false, code: "UPSTREAM_REJECTED", retryable: false, message: "No existe" };
      return { ok: true, externalLicenseId: id, status: cur.status, validUntil: cur.validUntil };
    },
  };
}

/**
 * Adaptador HTTP según el contrato propuesto en docs/contrato-licencias.md.
 * ESTA API NO EXISTE TODAVÍA: es la propuesta que debe aceptar o ajustar el desarrollador de la extensión.
 * Autenticación: HMAC-SHA256 sobre `${timestamp}.${método}.${ruta}.${cuerpo}` con secreto compartido.
 */
export interface HttpLicenseConfig {
  baseUrl: string;
  sharedSecret: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export function signLicenseRequest(secret: string, timestamp: string, method: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${method}.${path}.${body}`).digest("hex");
}

export function createHttpAdapter(cfg: HttpLicenseConfig): LicenseAdapter {
  const doFetch = cfg.fetchImpl ?? fetch;
  const now = cfg.now ?? (() => new Date());

  async function call(method: "GET" | "POST", path: string, payload?: unknown, idem?: string): Promise<LicenseOpResult> {
    const body = payload ? JSON.stringify(payload) : "";
    const ts = String(Math.floor(now().getTime() / 1000));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 8000);
    try {
      const res = await doFetch(new URL(path, cfg.baseUrl), {
        method,
        body: body || undefined,
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "x-luria-timestamp": ts,
          "x-luria-signature": signLicenseRequest(cfg.sharedSecret, ts, method, path, body),
          "x-request-id": randomUUID(),
          ...(idem ? { "idempotency-key": idem } : {}),
        },
      });
      if (!res.ok) {
        return {
          ok: false,
          code: res.status >= 500 || res.status === 429 ? "UPSTREAM_ERROR" : "UPSTREAM_REJECTED",
          retryable: res.status >= 500 || res.status === 429,
          message: `Servicio de licencias respondió ${res.status}`,
        };
      }
      const j = (await res.json()) as { license_id: string; status: "active" | "revoked" | "expired"; valid_until: string | null };
      return { ok: true, externalLicenseId: j.license_id, status: j.status, validUntil: j.valid_until ? new Date(j.valid_until) : null };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      return { ok: false, code: aborted ? "TIMEOUT" : "UPSTREAM_ERROR", retryable: true, message: "Sin respuesta del servicio de licencias" };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    mode: "http",
    simulated: false,
    grant: (r: GrantRequest) =>
      call("POST", "/v1/licenses/grant", {
        external_user_ref: r.externalUserRef,
        subscription_id: r.subscriptionId,
        valid_until: r.validUntil.toISOString(),
      }, r.idempotencyKey),
    revoke: (r: RevokeRequest) =>
      call("POST", "/v1/licenses/revoke", { license_id: r.externalLicenseId, reason: r.reason }, r.idempotencyKey),
    status: (id: string) => call("GET", `/v1/licenses/${encodeURIComponent(id)}`),
  };
}

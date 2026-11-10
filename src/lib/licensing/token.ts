import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { offlineTokenExpiry } from "../domain/access";

/**
 * OPCIÓN B (propuesta): la web actúa como autoridad de licencias.
 * La extensión consulta /api/licencia/validar y recibe un token firmado con Ed25519 cuyo
 * vencimiento NUNCA supera la vigencia pagada (A22). La extensión verifica con la llave pública
 * incrustada; sin conexión, el acceso termina cuando expira el token.
 * Requiere que el desarrollador de la extensión implemente la verificación (no existe hoy).
 */

export interface LicenseTokenPayload {
  iss: "luria-web";
  aud: "luria-extension";
  sub: string; // externalUserRef
  lic: string; // id de licencia
  iat: number;
  exp: number;
}

const b64u = (b: Buffer) => b.toString("base64url");

export function issueLicenseToken(
  privateKeyPem: string,
  args: { externalUserRef: string; licenseId: string; validUntil: Date | null; now: Date; ttlMs: number },
): { token: string; expiresAt: Date } | null {
  const exp = offlineTokenExpiry(args.validUntil, args.now, args.ttlMs);
  if (!exp) return null;
  const header = { alg: "EdDSA", typ: "JWT" };
  const payload: LicenseTokenPayload = {
    iss: "luria-web",
    aud: "luria-extension",
    sub: args.externalUserRef,
    lic: args.licenseId,
    iat: Math.floor(args.now.getTime() / 1000),
    exp: Math.floor(exp.getTime() / 1000),
  };
  const signingInput = `${b64u(Buffer.from(JSON.stringify(header)))}.${b64u(Buffer.from(JSON.stringify(payload)))}`;
  const key: KeyObject = createPrivateKey(privateKeyPem);
  const sig = sign(null, Buffer.from(signingInput), key);
  return { token: `${signingInput}.${b64u(sig)}`, expiresAt: new Date(payload.exp * 1000) };
}

/** Implementación de referencia de la verificación que haría la extensión. */
export function verifyLicenseToken(publicKeyPem: string, token: string, now: Date): LicenseTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  const ok = verify(null, Buffer.from(`${h}.${p}`), createPublicKey(publicKeyPem), Buffer.from(s, "base64url"));
  if (!ok) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as LicenseTokenPayload;
  if (payload.iss !== "luria-web" || payload.aud !== "luria-extension") return null;
  if (payload.exp * 1000 <= now.getTime()) return null;
  return payload;
}

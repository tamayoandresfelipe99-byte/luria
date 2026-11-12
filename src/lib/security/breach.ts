// Sin secretos: puede probarse fuera de Next. Se usa solo desde acciones de servidor.
import { createHash } from "node:crypto";

/**
 * ¿Aparece la contraseña en filtraciones conocidas? Usa la API de rangos de Have I Been Pwned con k-anonimato:
 * solo se envían los 5 primeros caracteres del SHA-1; la contraseña ni su hash completo salen del servidor.
 * Falla abierta (devuelve false) si el servicio no responde en 2 s, para no bloquear registros legítimos.
 * Se desactiva con PASSWORD_BREACH_CHECK=off (p. ej. en pruebas sin red).
 */
export async function isBreachedPassword(password: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (process.env.PASSWORD_BREACH_CHECK === "off") return false;
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "luria-web-password-check" },
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

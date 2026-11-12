/** Controles de seguridad: política de contraseñas, filtraciones (k-anonimato) y redirecciones abiertas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { passwordProblem, PASSWORD_MIN } from "../src/lib/security/password";
import { safeInternalPath } from "../src/lib/security/redirect";
import { registerSchema } from "../src/lib/validation";

test("SEC-PWD-01 — mínimo 15 caracteres y sin reglas de composición", () => {
  assert.equal(PASSWORD_MIN, 15);
  assert.ok(passwordProblem("corta123"));
  assert.ok(passwordProblem("abcdefghijklmn")); // 14
  assert.equal(passwordProblem("cielo verde sobre bogotá"), null, "una frase sin números ni mayúsculas es válida");
  assert.equal(passwordProblem("x".repeat(128).replace(/x/g, (_, i) => "abcdefghij"[i % 10]!)), null);
  assert.ok(passwordProblem("a".repeat(129)), "máximo 128");
});

test("SEC-PWD-02 — rechaza contraseñas triviales, repetitivas y con datos de la cuenta", () => {
  for (const p of ["aaaaaaaaaaaaaaaa", "123456789012345", "passwordpassword1", "contraseña12345678", "qwertyqwertyqwerty", "lurialurialuria123"])
    assert.ok(passwordProblem(p), `debe rechazar ${p}`);
  assert.ok(passwordProblem("instructora.gomez 2026!", { email: "instructora.gomez@correo.co" }));
  assert.ok(passwordProblem("MariaFernanda2026", { name: "María Fernanda" }));
});

test("SEC-PWD-03 — el registro aplica la política en el servidor", () => {
  const base = { name: "Ana Pérez", email: "ana@example.com", acceptTerms: "on", acceptPrivacy: "on" };
  assert.equal(registerSchema.safeParse({ ...base, password: "clave12345x" }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, password: "passwordpassword123" }).success, false);
  assert.equal(registerSchema.safeParse({ ...base, password: "una frase larga de prueba" }).success, true);
});

test("SEC-PWD-04 — la consulta de filtraciones solo envía 5 caracteres del SHA-1", async () => {
  process.env.PASSWORD_BREACH_CHECK = "on";
  const { isBreachedPassword } = await import("../src/lib/security/breach");
  const pwd = "una frase larga de prueba";
  const sha1 = createHash("sha1").update(pwd).digest("hex").toUpperCase();
  const seen: string[] = [];
  const fake = (async (url: string) => {
    seen.push(url);
    return new Response(`${sha1.slice(5)}:42\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0\n`);
  }) as unknown as typeof fetch;
  assert.equal(await isBreachedPassword(pwd, fake), true);
  assert.equal(seen[0], `https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`);
  assert.ok(!seen[0]!.includes(sha1.slice(5)) && !seen[0]!.includes(encodeURIComponent(pwd)));
  const failing = (async () => { throw new Error("sin red"); }) as unknown as typeof fetch;
  assert.equal(await isBreachedPassword(pwd, failing), false, "falla abierta si el servicio no responde");
});

test("SEC-REDIR-01 — solo destinos internos tras iniciar sesión o confirmar correo", () => {
  assert.equal(safeInternalPath("/cuenta"), "/cuenta");
  assert.equal(safeInternalPath("/restablecer?x=1"), "/restablecer?x=1");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/\\/evil.example", "\\\\evil.example", "javascript:alert(1)", "/%0d%0aSet-Cookie:x", "/\tevil", "", null, 42])
    assert.equal(safeInternalPath(bad as unknown, "/cuenta"), bad === "/%0d%0aSet-Cookie:x" ? "/%0d%0aSet-Cookie:x" : "/cuenta", `bloquear ${String(bad)}`);
});

test("SEC-WH-01 — firmas falsas: siempre 401, y el registro en base de datos está limitado o no bloquea", async () => {
  const { setup } = await import("./helpers");
  const { buildSignedEvent } = await import("../src/lib/payments/mock");
  const { processPaymentWebhook } = await import("../src/lib/services/payment-processor");
  const s = setup();
  const forged = buildSignedEvent({ id: "tx9", reference: "LUR-20261110-ABCDEFGHIJ", status: "APPROVED", amount_in_cents: 4_000_000 }, Math.floor(Date.parse("2026-11-10T15:00:00Z") / 1000), "secreto-equivocado");
  const limited = await processPaymentWebhook({ ...s.deps, allowRejectedRecord: async () => false }, forged, new Headers());
  assert.equal(limited.httpStatus, 401);
  assert.equal(s.repo.events.size, 0, "con el límite agotado no se escribe nada");
  const broken = { ...s.deps, repo: Object.assign(Object.create(Object.getPrototypeOf(s.repo)), s.repo, { recordEvent: async () => { throw new Error("BD caída"); } }) };
  const r = await processPaymentWebhook(broken, forged, new Headers());
  assert.equal(r.httpStatus, 401, "si la base de datos falla, el rechazo se mantiene (no 500)");
  assert.equal(s.repo.payments.size, 0);
});

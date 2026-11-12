/** Controles de seguridad: política de contraseñas, redirecciones abiertas y webhooks falsos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordProblem, PASSWORD_MIN } from "../src/lib/security/password";
import { safeInternalPath } from "../src/lib/security/redirect";
import { registerSchema } from "../src/lib/validation";

test("SEC-PWD-01 — mínimo 10 caracteres y sin reglas de composición", () => {
  assert.equal(PASSWORD_MIN, 10);
  assert.ok(passwordProblem("corta123"));
  assert.ok(passwordProblem("abcdefghi")); // 9
  assert.equal(passwordProblem("cielo azul"), null, "10 caracteres sin números es válida");
  for (const p of ["1234567890", "aaaaaaaaaa", "passwordpassword", "contraseña123"]) assert.equal(passwordProblem(p), null, `${p} se permite (decisión del propietario)`);
  assert.ok(passwordProblem("a".repeat(129)), "máximo 128");
});

test("SEC-PWD-02 — no puede ser el nombre ni el apellido, aunque lleve números o símbolos", () => {
  const name = "María Fernanda Gómez Paz";
  for (const p of ["mariafernanda", "Gomez12345", "GÓMEZ GÓMEZ!", "fernanda2026", "maria gomez paz", "Paz123456789"])
    assert.ok(passwordProblem(p, { name }), `debe rechazar ${p}`);
  for (const p of ["maria es feliz", "gomezfamilia2026", "mi perro firulais"]) assert.equal(passwordProblem(p, { name }), null, `debe aceptar ${p}`);
});

test("SEC-PWD-03 — el registro aplica la política en el servidor", () => {
  const base = { name: "Ana Pérez", email: "ana@example.com", acceptTerms: "on", acceptPrivacy: "on" };
  assert.equal(registerSchema.safeParse({ ...base, password: "clave1234" }).success, false, "9 caracteres");
  assert.equal(registerSchema.safeParse({ ...base, password: "PEREZ123456" }).success, false, "su apellido");
  assert.equal(registerSchema.safeParse({ ...base, password: "clave12345x" }).success, true);
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

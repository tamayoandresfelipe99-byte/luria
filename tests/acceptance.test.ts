/**
 * Casos de aceptación A01–A22 cubiertos por lógica TypeScript.
 * Los casos con dependencia de base de datos (A10 y la autoridad SQL de A03/A05/A07/A13/A14)
 * se prueban además en supabase/tests/*.sql contra PostgreSQL.
 * A17 se prueba con Playwright sobre el prototipo (scripts/check-prototype.mjs).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { setup } from "./helpers";
import { hasExtensionAccess, customerState, purchaseGate, canSendMarketing, offlineTokenExpiry } from "../src/lib/domain/access";
import { computeNextPeriod, endOfBogotaDay, toBogotaDate, formatBogotaDate } from "../src/lib/domain/time";
import { createPendingAdapter } from "../src/lib/licensing/adapters";
import { issueLicenseToken, verifyLicenseToken } from "../src/lib/licensing/token";
import { assertSafeConfig, loadConfig, realChargeBlockers, realChargesEnabled } from "../src/lib/config";
import { buildSignedEvent } from "../src/lib/payments/mock";
import { processPaymentWebhook } from "../src/lib/services/payment-processor";
import { createOrderSchema, registerSchema, supportSchema } from "../src/lib/validation";

const NOW = new Date("2026-11-10T15:00:00Z");

test("A01 — registro sin pago no concede acceso", () => {
  assert.equal(hasExtensionAccess(null, NOW), false);
  assert.equal(customerState({ lastPaymentStatus: null, subscription: null, license: null }, NOW), "sin_suscripcion");
});

test("A02 — rechazar marketing no bloquea registro ni compra", () => {
  const r = registerSchema.safeParse({ name: "Ana Pérez", email: "ana@example.com", password: "una frase larga de prueba", acceptTerms: "on", acceptPrivacy: "on" });
  assert.ok(r.success);
  const g = purchaseGate({ authenticated: true, acceptedTerms: true, eligibility: "verified", acknowledgedDesktopRequirement: true, realChargesEnabled: true, simulationAllowed: false, hasActiveFuturePeriod: false });
  assert.equal(g.allowed, true);
  assert.equal(canSendMarketing([]), false);
});

test("A03 — pago aprobado registra una única vigencia", async () => {
  const s = setup();
  const r = await s.send("tx1", "approved");
  assert.equal(r.outcome, "applied:approved");
  assert.equal(s.repo.periods.size, 1);
  const sub = [...s.repo.subscriptions.values()][0]!;
  assert.equal(sub.status, "active");
  assert.equal(sub.currentPeriodEnd!.toISOString(), "2026-12-11T04:59:59.999Z"); // 10-dic 23:59:59.999 Bogotá
});

test("A04 — manipular precio desde el navegador no altera el pago", async () => {
  // 1) El esquema de compra rechaza cualquier campo de precio.
  const bad = createOrderSchema.safeParse({ acceptPurchaseTerms: true, acknowledgedDesktop: true, idempotencyKey: crypto.randomUUID(), amount: 100 });
  assert.equal(bad.success, false);
  // 2) Un pago por un valor distinto al del pedido no habilita nada.
  const s = setup();
  const r = await s.send("tx-cheap", "approved", { amountCents: 100_00 });
  assert.equal(r.outcome, "amount_mismatch");
  assert.equal(s.repo.periods.size, 0);
  assert.equal(s.repo.subscriptions.size, 0);
  // 3) Un estado "aprobado" en el evento no manda: manda la consulta al proveedor.
  const s2 = setup();
  const r2 = await s2.send("tx-lie", "declined", { claimed: "APPROVED" });
  assert.equal(r2.outcome, "applied:declined");
  assert.equal(s2.repo.periods.size, 0);
});

test("A05 — webhook duplicado no duplica suscripción, licencia ni comisión", async () => {
  const s = setup();
  const body = () => {
    s.provider.store.set("tx1", { provider: "mock", transactionId: "tx1", reference: "LUR-20261110-ABCDEFGHIJ", amountInCents: 4_000_000, currency: "COP", status: "approved", paymentMethodType: "CARD", finalizedAt: NOW });
    return buildSignedEvent({ id: "tx1", reference: "LUR-20261110-ABCDEFGHIJ", status: "APPROVED", amount_in_cents: 4_000_000 }, Math.floor(NOW.getTime() / 1000));
  };
  const b = body();
  const r1 = await processPaymentWebhook(s.deps, b, new Headers());
  const r2 = await processPaymentWebhook(s.deps, b, new Headers());
  // mismo pago, evento distinto (otro timestamp)
  s.setNow(new Date(NOW.getTime() + 60_000));
  const r3 = await s.send("tx1", "approved");
  assert.equal(r1.outcome, "applied:approved");
  assert.equal(r2.outcome, "duplicate");
  assert.equal(r3.outcome, "noop");
  assert.equal(s.repo.periods.size, 1);
  assert.equal(s.repo.subscriptions.size, 1);
  assert.equal(s.repo.licenses.size, 1);
  assert.equal(s.repo.commissions.size, 1);
});

test("A06 — evento con firma falsa se rechaza", async () => {
  const s = setup();
  const forged = buildSignedEvent({ id: "tx1", reference: "LUR-20261110-ABCDEFGHIJ", status: "APPROVED", amount_in_cents: 4_000_000 }, Math.floor(NOW.getTime() / 1000), "secreto-equivocado");
  const r = await processPaymentWebhook(s.deps, forged, new Headers());
  assert.equal(r.httpStatus, 401);
  assert.equal(s.repo.payments.size, 0);
  // alterar el cuerpo después de firmar
  const ok = JSON.parse(buildSignedEvent({ id: "tx1", reference: "LUR-20261110-ABCDEFGHIJ", status: "DECLINED", amount_in_cents: 4_000_000 }, Math.floor(NOW.getTime() / 1000)));
  ok.data.transaction.status = "APPROVED";
  const r2 = await processPaymentWebhook(s.deps, JSON.stringify(ok), new Headers());
  assert.equal(r2.httpStatus, 401);
  // evento viejo (repetición)
  const old = buildSignedEvent({ id: "tx1", reference: "LUR-20261110-ABCDEFGHIJ", status: "APPROVED", amount_in_cents: 4_000_000 }, Math.floor(NOW.getTime() / 1000) - 5 * 86400);
  const r3 = await processPaymentWebhook(s.deps, old, new Headers());
  assert.equal(r3.outcome, "rejected:stale");
});

test("A07 — eventos fuera de orden mantienen consistencia", async () => {
  const s = setup();
  await s.send("tx1", "approved");
  s.setNow(new Date(NOW.getTime() + 1000));
  const late = await s.send("tx1", "pending"); // el proveedor ya dice approved, pero simulemos que llega PENDING atrasado
  assert.equal(late.outcome, "noop");
  const pay = [...s.repo.payments.values()][0]!;
  assert.equal(pay.status, "approved");
  // contradicción final → revisión humana, sin cambios
  s.setNow(new Date(NOW.getTime() + 2000));
  const contra = await s.send("tx1", "declined");
  assert.equal(contra.outcome, "conflict");
  assert.equal(pay.status, "approved");
});

test("A08 — pago pendiente o rechazado no habilita uso", async () => {
  for (const st of ["pending", "declined"] as const) {
    const s = setup();
    await s.send("tx-" + st, st);
    assert.equal(s.repo.subscriptions.size, 0);
    assert.equal(customerState({ lastPaymentStatus: st, subscription: null, license: null }, NOW), st === "pending" ? "pago_pendiente" : "pago_rechazado");
  }
});

test("A09 — pago aprobado con fallo de licencia genera tarea auditable", async () => {
  const s = setup({ licenses: createPendingAdapter() });
  const r = await s.send("tx1", "approved");
  assert.equal(r.outcome, "applied:approved");
  assert.equal(s.repo.tasks.size, 1);
  const task = [...s.repo.tasks.values()][0]!;
  assert.equal(task.kind, "activation");
  assert.equal(task.errorCode, "LICENSE_ADAPTER_PENDING");
  const sub = [...s.repo.subscriptions.values()][0]!;
  const lic = s.repo.licenses.get(sub.id)!;
  assert.equal(hasExtensionAccess(lic, NOW), false);
  assert.equal(customerState({ lastPaymentStatus: "approved", subscription: { status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: false }, license: lic }, NOW), "activacion_pendiente");
  // Reintento del mismo evento no duplica tareas
  await s.send("tx1", "approved");
  assert.equal(s.repo.tasks.size, 1);
});

test("A11 — período vencido: sin acceso", () => {
  const lic = { status: "active" as const, validUntil: new Date("2026-11-10T04:59:59.999Z") };
  assert.equal(hasExtensionAccess(lic, NOW), false);
  assert.equal(hasExtensionAccess(lic, new Date("2026-11-10T04:59:59.000Z")), true);
});

test("A12 — cancelar renovaciones futuras mantiene acceso hasta el fin del período", () => {
  const end = new Date("2026-12-11T04:59:59.999Z");
  const lic = { status: "active" as const, validUntil: end };
  const snap = { lastPaymentStatus: "approved" as const, subscription: { status: "active" as const, currentPeriodEnd: end, cancelAtPeriodEnd: true }, license: lic };
  assert.equal(customerState(snap, NOW), "cancelada_al_final");
  assert.equal(hasExtensionAccess(lic, NOW), true);
  assert.equal(customerState(snap, new Date(end.getTime() + 1)), "vencida");
});

test("A13 — renovación: sin duplicar vigencias y sin perder días", async () => {
  const s = setup();
  await s.send("tx1", "approved");
  s.repo.addOrder({ id: "o2", userId: "u1", reference: "LUR-20261205-KLMNOPQRST", amountCop: 40000, currency: "COP" });
  s.setNow(new Date("2026-12-05T15:00:00Z"));
  await s.send("tx2", "approved", { reference: "LUR-20261205-KLMNOPQRST" });
  await s.send("tx2", "approved", { reference: "LUR-20261205-KLMNOPQRST" }); // reintento
  assert.equal(s.repo.periods.size, 2);
  const sub = [...s.repo.subscriptions.values()][0]!;
  assert.equal(sub.currentPeriodEnd!.toISOString(), "2027-01-11T04:59:59.999Z"); // 10-ene 23:59 Bogotá
});

test("A14 — reembolso o reversión revoca y registra el ajuste", async () => {
  const s = setup();
  await s.send("tx1", "approved");
  s.setNow(new Date(NOW.getTime() + 3600_000));
  const r = await s.send("tx1", "refunded");
  assert.equal(r.outcome, "applied:refunded");
  const sub = [...s.repo.subscriptions.values()][0]!;
  assert.equal(sub.status, "revoked");
  assert.equal(s.repo.licenses.get(sub.id)!.status, "revoked");
  assert.equal(s.repo.commissions.size, 0);
  assert.ok(s.repo.audit.some((a) => a.action === "payment.refunded"));
});

test("A15 — entorno no verificado no permite compra", () => {
  const base = { authenticated: true, acceptedTerms: true, acknowledgedDesktopRequirement: true, realChargesEnabled: true, simulationAllowed: false, hasActiveFuturePeriod: false };
  assert.equal(purchaseGate({ ...base, eligibility: "unverified" }).allowed, false);
  assert.equal(purchaseGate({ ...base, eligibility: "incompatible" }).allowed, false);
  assert.equal(purchaseGate({ ...base, eligibility: "verified", acknowledgedDesktopRequirement: false }).allowed, false);
});

test("A16 — recuperación no revela si un correo existe", async () => {
  const { recoverAccountMessage } = await import("../src/lib/services/auth-messages");
  assert.equal(recoverAccountMessage(true), recoverAccountMessage(false));
});

test("A18 — retirar consentimiento comercial detiene promociones", () => {
  const t0 = new Date("2026-11-01T00:00:00Z");
  const t1 = new Date("2026-11-05T00:00:00Z");
  assert.equal(canSendMarketing([{ purpose: "marketing", granted: true, at: t0 }]), true);
  assert.equal(canSendMarketing([{ purpose: "marketing", granted: true, at: t0 }, { purpose: "marketing", granted: false, at: t1 }]), false);
});

test("A19 — el código cliente no contiene secretos ni variables de servidor", () => {
  const SERVER_ONLY = /(SUPABASE_SERVICE_ROLE_KEY|WOMPI_INTEGRITY_SECRET|WOMPI_EVENTS_SECRET|LICENSE_API_SHARED_SECRET|LICENSE_TOKEN_PRIVATE_KEY|CRON_SECRET|prv_prod_|prod_events_|prod_integrity_)/;
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(f)) {
        const src = readFileSync(p, "utf8");
        const isClient = /^\s*["']use client["']/.test(src);
        if (isClient && SERVER_ONLY.test(src)) offenders.push(p);
        if (isClient && /from\s+["'](@\/lib\/(config|payments|licensing|supabase\/admin|services)|node:crypto)/.test(src)) offenders.push(p + " (importa módulo de servidor)");
      }
    }
  };
  walk(join(__dirname, "..", "src"));
  assert.deepEqual(offenders, []);
  const envExample = readFileSync(join(__dirname, "..", ".env.example"), "utf8");
  assert.ok(!/=(prv_|prod_|sk_|eyJ)/.test(envExample), ".env.example no debe contener valores reales");
});

test("A20 — producción no admite simulaciones y cobros reales exigen condiciones", () => {
  assert.throws(() => assertSafeConfig(loadConfig({ APP_ENV: "production", PAYMENT_PROVIDER: "mock", NEXT_PUBLIC_APP_URL: "https://luria.example" })));
  assert.throws(() => assertSafeConfig(loadConfig({ APP_ENV: "production", PAYMENT_PROVIDER: "wompi", LICENSE_ADAPTER: "simulated", WOMPI_ENVIRONMENT: "production", NEXT_PUBLIC_APP_URL: "https://luria.example" })));
  const cfg = loadConfig({ APP_ENV: "production", PAYMENT_PROVIDER: "wompi", WOMPI_ENVIRONMENT: "production", NEXT_PUBLIC_APP_URL: "https://luria.example" });
  assert.equal(realChargesEnabled(cfg), false);
  const keys = realChargeBlockers(cfg).map((m) => m.key);
  for (const k of ["SELLER_IDENTITY", "LEGAL_TEXTS", "PRICE_TAX_TREATMENT", "LICENSE_ADAPTER", "EXTENSION_INSTALL_URL", "ACTIVATION_SLA"]) assert.ok(keys.includes(k), k);
});

test("A21 — fechas y vencimientos mensuales en hora de Colombia", () => {
  // Pago a las 21:00 del 31-ene en Bogotá (02:00Z del 1-feb) → el día ancla es 31, no 1.
  const p1 = computeNextPeriod({ paidAt: new Date("2027-02-01T02:00:00Z") });
  assert.equal(p1.anchorDay, 31);
  assert.deepEqual(toBogotaDate(p1.end), { y: 2027, m: 2, d: 28 });
  const p2 = computeNextPeriod({ paidAt: new Date("2027-02-20T12:00:00Z"), currentEnd: p1.end, anchorDay: p1.anchorDay });
  assert.deepEqual(toBogotaDate(p2.end), { y: 2027, m: 3, d: 31 }); // no deriva a 28
  // Año bisiesto
  const leap = computeNextPeriod({ paidAt: new Date("2028-01-31T15:00:00Z") });
  assert.deepEqual(toBogotaDate(leap.end), { y: 2028, m: 2, d: 29 });
  // Diciembre → enero
  const dec = computeNextPeriod({ paidAt: new Date("2026-12-15T15:00:00Z") });
  assert.deepEqual(toBogotaDate(dec.end), { y: 2027, m: 1, d: 15 });
  // Renovación tardía: ancla nueva, sin días gratis retroactivos
  const late = computeNextPeriod({ paidAt: new Date("2027-04-10T15:00:00Z"), currentEnd: p2.end, anchorDay: 31 });
  assert.equal(late.continuation, false);
  assert.equal(late.anchorDay, 10);
  // Fin de día en Bogotá = 04:59:59.999Z del día siguiente
  assert.equal(endOfBogotaDay({ y: 2026, m: 11, d: 10 }).toISOString(), "2026-11-11T04:59:59.999Z");
  assert.equal(formatBogotaDate(new Date("2026-11-11T04:59:59.999Z")), "10 de noviembre de 2026");
  // Coherencia con la base de zonas horarias del sistema
  const viaIntl = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date("2026-11-11T04:59:59.999Z"));
  assert.equal(viaIntl, "2026-11-10");
});

test("A22 — licencia sin conexión no se extiende más allá de lo pagado", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const priv = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const pub = publicKey.export({ type: "spki", format: "pem" }).toString();
  const validUntil = new Date(NOW.getTime() + 3 * 3600_000);
  const t = issueLicenseToken(priv, { externalUserRef: "usr_1", licenseId: "lic1", validUntil, now: NOW, ttlMs: 24 * 3600_000 })!;
  assert.ok(t.expiresAt.getTime() <= validUntil.getTime());
  assert.ok(verifyLicenseToken(pub, t.token, NOW));
  assert.equal(verifyLicenseToken(pub, t.token, new Date(validUntil.getTime() + 1000)), null);
  assert.equal(issueLicenseToken(priv, { externalUserRef: "usr_1", licenseId: "lic1", validUntil: new Date(NOW.getTime() - 1), now: NOW, ttlMs: 1 }), null);
  assert.equal(offlineTokenExpiry(null, NOW, 1000), null);
  // token alterado
  const [h, p, sig] = t.token.split(".");
  const tampered = JSON.parse(Buffer.from(p!, "base64url").toString());
  tampered.exp += 86400 * 30;
  assert.equal(verifyLicenseToken(pub, `${h}.${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${sig}`, NOW), null);
});

test("Soporte — no acepta contraseñas en la descripción", () => {
  assert.equal(supportSchema.safeParse({ category: "tecnica", description: "mi contraseña: 1234 de zajuna no funciona" }).success, false);
});

test("A15 — clasificación de elegibilidad", async () => {
  const { classifyEligibility } = await import("../src/lib/domain/eligibility");
  const ok = { platform: "zajuna", browser: "chrome", device: "portatil", virtualOnly: "si" } as const;
  assert.equal(classifyEligibility(ok, true).result, "verificado");
  assert.equal(classifyEligibility(ok, false).result, "en_prueba", "sin entornos verificados no se habilita la compra");
  assert.equal(classifyEligibility({ ...ok, device: "celular" }, true).result, "no_compatible");
  assert.equal(classifyEligibility({ ...ok, browser: "safari" }, true).result, "no_compatible");
  assert.equal(classifyEligibility({ ...ok, platform: "otra" }, true).result, "no_compatible");
});

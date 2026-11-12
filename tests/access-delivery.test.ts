/** Separación entre estado de pago y entrega del acceso: mensajes del cliente y filtro del panel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientAccessMessage, needsAccess, type AccessStatus, type PaymentState } from "../src/lib/domain/access-delivery";

test("ACC-01 — pago confirmado + acceso pendiente: mensaje de preparación, sin botón", () => {
  const m = clientAccessMessage("al_dia", "pendiente", false);
  assert.equal(m.text, "Tu pago ha sido confirmado. Estamos preparando tu acceso a LURIA. Te notificaremos cuando esté disponible.");
  assert.equal(m.showAccessButton, false);
});

test("ACC-02 — pago confirmado + acceso habilitado: botón «Acceder a LURIA»", () => {
  const m = clientAccessMessage("al_dia", "habilitado", true);
  assert.equal(m.text, "Tu suscripción está activa y ya puedes utilizar LURIA.");
  assert.equal(m.showAccessButton, true);
  // Sin enlace entregado por el servidor no hay botón, aunque el estado diga habilitado.
  assert.equal(clientAccessMessage("al_dia", "habilitado", false).showAccessButton, false);
});

test("ACC-03 — pago pendiente: completar el pago; nunca botón", () => {
  for (const a of ["pendiente", "habilitado", "enlace_guardado"] as AccessStatus[]) {
    const m = clientAccessMessage("pendiente_pago", a, true);
    assert.equal(m.text, "Completa el pago de tu suscripción para habilitar tu acceso.");
    assert.equal(m.showAccessButton, false);
  }
});

test("ACC-04 — suscripción vencida: renovar; nunca botón aunque el acceso estuviera habilitado", () => {
  const m = clientAccessMessage("vencido", "habilitado", true);
  assert.equal(m.text, "Tu suscripción ha vencido. Renueva tu plan para continuar utilizando LURIA.");
  assert.equal(m.showAccessButton, false);
  assert.equal(m.cta?.href, "/compra");
});

test("ACC-05 — filtro «Pagaron, pero no tienen acceso»", () => {
  const cases: [PaymentState, AccessStatus, boolean][] = [
    ["al_dia", "pendiente", true],
    ["al_dia", "enlace_guardado", true],
    ["por_vencer", "suspendido", true],
    ["al_dia", "revocado", true],
    ["al_dia", "habilitado", false],
    ["vencido", "pendiente", false],
    ["pendiente_pago", "pendiente", false],
    ["en_verificacion", "pendiente", false],
  ];
  for (const [p, a, want] of cases) assert.equal(needsAccess(p, a), want, `${p} + ${a}`);
});

/** F01–F06: contenido íntegro de los seis módulos y estado de validación correcto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURES, claimDisclaimer, isPublishableAsVerified } from "../src/lib/content/features";

const EXPECTED: Record<string, { name: string; characteristics: string[]; benefit: string }> = {
  "vigia-calificacion": {
    name: "Vigía de calificación",
    characteristics: ["Consulta centralizada de evidencias y entregas.", "Identificación de pendientes.", "Identificación de entregas listas para calificar.", "Visualización de novedades.", "Filtros.", "Descarga de evidencias.", "Envío de calificaciones a ZAJUNA."],
    benefit: "Más control y menos tiempo de revisión.",
  },
  "paquete-evidencias": {
    name: "Paquete de evidencias para certificación",
    characteristics: ["Reunir evidencias por aprendiz.", "Descargar documentación.", "Organizar soportes.", "Consolidar información.", "Facilitar procesos de certificación, auditoría y consulta."],
    benefit: "Documentación organizada de manera más eficiente.",
  },
  "matriz-evidencias": {
    name: "Informe de matriz de evidencias",
    characteristics: ["Matriz de aprendices y evidencias.", "Estados de aprobación.", "Pendientes.", "Evidencias sin entregar.", "Novedades.", "Visión consolidada."],
    benefit: "Seguimiento académico centralizado.",
  },
  "gestor-fechas": {
    name: "Gestor de fechas",
    characteristics: ["Gestión de apertura.", "Gestión de cierre.", "Gestión de fechas de calificación.", "Modificaciones por evidencia.", "Modificaciones por fase.", "Modificaciones en bloque."],
    benefit: "Organización del cronograma y reducción de tareas repetitivas.",
  },
  "juicios-evaluativos": {
    name: "Juicios evaluativos",
    characteristics: ["Análisis del reporte oficial de la ficha.", "Consolidación de aprobados.", "Consolidación de no aprobados.", "Consolidación de pendientes.", "Indicadores.", "Reportes exportables."],
    benefit: "Información organizada para seguimiento y toma de decisiones.",
  },
  reenvios: {
    name: "Reenvíos",
    characteristics: ["Identificación de evidencias que requieren reenvío.", "Gestión de reenvíos.", "Seguimiento de segundas entregas.", "Consulta de estados.", "Apoyo a la validación de entregas corregidas."],
    benefit: "Mayor control del proceso de recuperación académica.",
  },
};

const ids = Object.keys(EXPECTED);
ids.forEach((id, i) => {
  test(`F0${i + 1} — ${EXPECTED[id]!.name}: descripción íntegra y estado correcto`, () => {
    const f = FEATURES.find((x) => x.id === id);
    assert.ok(f, "módulo presente");
    assert.equal(f.order, i + 1);
    assert.equal(f.name, EXPECTED[id]!.name);
    assert.deepEqual(f.characteristics, EXPECTED[id]!.characteristics);
    assert.equal(f.benefit, EXPECTED[id]!.benefit);
    assert.equal(f.status, "declarada", "sin validación técnica no puede publicarse como verificada");
    assert.ok(claimDisclaimer(f), "debe mostrar aviso de declaración");
    assert.equal(isPublishableAsVerified(f), false);
    assert.equal(f.demo, null, "no hay demostración autorizada todavía");
    assert.ok(f.limitations.length > 0 && f.requirements.length > 0);
    const text = JSON.stringify(f).toLowerCase();
    assert.ok(!/en minutos|garantiza|100 ?%|oficial del sena|aprobado por el sena/.test(text), "sin promesas no verificables");
  });
});

test("F03 — no inventa formatos de exportación de la matriz", () => {
  const f = FEATURES.find((x) => x.id === "matriz-evidencias")!;
  assert.ok(!/excel|xlsx|pdf|csv/i.test(f.characteristics.join(" ")));
});

test("Exactamente seis módulos", () => assert.equal(FEATURES.length, 6));

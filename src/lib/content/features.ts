/**
 * FUNCIONALIDADES DE LURIA
 * Fuente: ficha gráfica suministrada por el propietario del proyecto (10-nov-2026).
 * La ficha NO constituye validación técnica. Cada módulo inicia como "declarada".
 * Para pasar a "verificada" se requiere evidencia técnica registrada (tabla `features`).
 *
 * Diferencias deliberadas con la ficha:
 *  - La ficha dice "documentación organizada en minutos"; se publica "de manera más eficiente"
 *    (texto del brief) porque no hay medición que respalde un tiempo concreto.
 *  - Las capturas de la ficha son ilustraciones; no se usan como capturas de funcionamiento real.
 */

export type FeatureStatus = "declarada" | "en_validacion" | "verificada" | "parcial" | "no_disponible";

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  declarada: "Declarada por el fabricante",
  en_validacion: "En validación técnica",
  verificada: "Verificada",
  parcial: "Parcialmente disponible",
  no_disponible: "No disponible",
};

export interface Feature {
  id: string;
  order: number;
  name: string;
  summary: string;
  problem: string;
  characteristics: string[];
  benefit: string;
  requirements: string[];
  limitations: string[];
  status: FeatureStatus;
  evidence: string | null;
  verifiedVersion: string | null;
  demo: { kind: "video" | "imagenes" | "guia"; url: string; authorized: true } | null;
}

const COMMON_REQUIREMENTS = [
  "Google Chrome en computador de escritorio o portátil.",
  "Entorno ZAJUNA compatible (ver página de compatibilidad).",
  "Suscripción vigente y licencia activada.",
];

const COMMON_LIMITATIONS = [
  "Funciona dentro del entorno compatible del instructor; no reemplaza ni modifica las políticas de la plataforma institucional.",
  "Las acciones sobre información académica las realiza y revisa el instructor, que es responsable de su uso.",
  "LURIA no tiene relación comercial ni institucional con el SENA.",
];

export const FEATURES: Feature[] = [
  {
    id: "vigia-calificacion",
    order: 1,
    name: "Vigía de calificación",
    summary: "Consulta evidencias y entregas de la ficha en una sola vista.",
    problem: "Revisar entrega por entrega para saber qué está pendiente, qué está listo para calificar y qué tiene novedades consume mucho tiempo.",
    characteristics: [
      "Consulta centralizada de evidencias y entregas.",
      "Identificación de pendientes.",
      "Identificación de entregas listas para calificar.",
      "Visualización de novedades.",
      "Filtros.",
      "Descarga de evidencias.",
      "Envío de calificaciones a ZAJUNA.",
    ],
    benefit: "Más control y menos tiempo de revisión.",
    requirements: COMMON_REQUIREMENTS,
    limitations: [
      ...COMMON_LIMITATIONS,
      "El envío de calificaciones depende de que el entorno compatible lo permita en el momento de uso.",
    ],
    status: "declarada",
    evidence: null,
    verifiedVersion: null,
    demo: null,
  },
  {
    id: "paquete-evidencias",
    order: 2,
    name: "Paquete de evidencias para certificación",
    summary: "Reúne las evidencias de un aprendiz en un solo proceso.",
    problem: "Consolidar soportes por aprendiz para certificación, auditoría o consulta implica descargas y organización manual repetitiva.",
    characteristics: [
      "Reunir evidencias por aprendiz.",
      "Descargar documentación.",
      "Organizar soportes.",
      "Consolidar información.",
      "Facilitar procesos de certificación, auditoría y consulta.",
    ],
    benefit: "Documentación organizada de manera más eficiente.",
    requirements: COMMON_REQUIREMENTS,
    limitations: [...COMMON_LIMITATIONS, "Los formatos de descarga disponibles dependen de los archivos que existan en el entorno."],
    status: "declarada",
    evidence: null,
    verifiedVersion: null,
    demo: null,
  },
  {
    id: "matriz-evidencias",
    order: 3,
    name: "Informe de matriz de evidencias",
    summary: "Genera una matriz de aprendices y evidencias de la ficha.",
    problem: "Sin una vista consolidada es difícil saber el estado general de la ficha por aprendiz y por evidencia.",
    characteristics: [
      "Matriz de aprendices y evidencias.",
      "Estados de aprobación.",
      "Pendientes.",
      "Evidencias sin entregar.",
      "Novedades.",
      "Visión consolidada.",
    ],
    benefit: "Seguimiento académico centralizado.",
    requirements: COMMON_REQUIREMENTS,
    limitations: [
      ...COMMON_LIMITATIONS,
      "Los formatos de exportación de la matriz están pendientes de confirmación técnica y no se anuncian hasta verificarse.",
    ],
    status: "declarada",
    evidence: null,
    verifiedVersion: null,
    demo: null,
  },
  {
    id: "gestor-fechas",
    order: 4,
    name: "Gestor de fechas",
    summary: "Organiza fechas de apertura, cierre y calificación.",
    problem: "Ajustar fechas evidencia por evidencia es una tarea repetitiva y propensa a errores.",
    characteristics: [
      "Gestión de apertura.",
      "Gestión de cierre.",
      "Gestión de fechas de calificación.",
      "Modificaciones por evidencia.",
      "Modificaciones por fase.",
      "Modificaciones en bloque.",
    ],
    benefit: "Organización del cronograma y reducción de tareas repetitivas.",
    requirements: COMMON_REQUIREMENTS,
    limitations: [...COMMON_LIMITATIONS, "Los cambios en bloque deben revisarse antes de confirmarlos; aplican sobre la información del entorno."],
    status: "declarada",
    evidence: null,
    verifiedVersion: null,
    demo: null,
  },
  {
    id: "juicios-evaluativos",
    order: 5,
    name: "Juicios evaluativos",
    summary: "Analiza el reporte oficial de la ficha.",
    problem: "Consolidar aprobados, no aprobados y pendientes a partir del reporte de la ficha requiere trabajo manual.",
    characteristics: [
      "Análisis del reporte oficial de la ficha.",
      "Consolidación de aprobados.",
      "Consolidación de no aprobados.",
      "Consolidación de pendientes.",
      "Indicadores.",
      "Reportes exportables.",
    ],
    benefit: "Información organizada para seguimiento y toma de decisiones.",
    requirements: [...COMMON_REQUIREMENTS, "Disponer del reporte oficial de la ficha en el entorno."],
    limitations: [...COMMON_LIMITATIONS, "Los indicadores se calculan sobre el reporte disponible; LURIA no altera los juicios registrados."],
    status: "declarada",
    evidence: null,
    verifiedVersion: null,
    demo: null,
  },
  {
    id: "reenvios",
    order: 6,
    name: "Reenvíos",
    summary: "Identifica evidencias que requieren reenvío.",
    problem: "Hacer seguimiento a segundas entregas y validar correcciones se dispersa entre muchas pantallas.",
    characteristics: [
      "Identificación de evidencias que requieren reenvío.",
      "Gestión de reenvíos.",
      "Seguimiento de segundas entregas.",
      "Consulta de estados.",
      "Apoyo a la validación de entregas corregidas.",
    ],
    benefit: "Mayor control del proceso de recuperación académica.",
    requirements: COMMON_REQUIREMENTS,
    limitations: [...COMMON_LIMITATIONS, "La validación final de una entrega corregida la decide el instructor."],
    status: "declarada",
    evidence: null,
    verifiedVersion: null,
    demo: null,
  },
];

/** Aviso que acompaña toda funcionalidad no verificada. */
export function claimDisclaimer(f: Feature): string | null {
  if (f.status === "verificada") return null;
  return `${FEATURE_STATUS_LABEL[f.status]}. La descripción proviene del fabricante y está pendiente de confirmación técnica individual.`;
}

/** Una función solo puede marcarse verificada si tiene evidencia y versión. */
export function isPublishableAsVerified(f: Feature): boolean {
  return f.status === "verificada" && !!f.evidence && !!f.verifiedVersion;
}

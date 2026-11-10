/**
 * Reglas de fechas de LURIA.
 *
 * Colombia (America/Bogota) usa UTC-05:00 fijo, sin horario de verano desde 1993.
 * Todas las vigencias se calculan sobre la fecha civil de Bogotá.
 *
 * REGLA DE ANIVERSARIO MENSUAL (pendiente de confirmación jurídica, ver docs/legal-pendiente.md):
 *  - El "día ancla" es el día del mes (en Bogotá) en que inicia la primera vigencia.
 *  - Cada período vence al final (23:59:59.999, hora de Bogotá) del mismo número de día
 *    del mes siguiente (criterio de plazos de meses: mismo número de día).
 *  - Si el mes siguiente no tiene ese día (p. ej. 31 → febrero), vence el último día de ese mes,
 *    y el ancla se conserva (31 ene → 28/29 feb → 31 mar). No hay deriva acumulada.
 *  - Una renovación pagada ANTES del vencimiento extiende desde el vencimiento vigente (sin perder días).
 *  - Una renovación pagada DESPUÉS del vencimiento inicia un período nuevo con un ancla nueva.
 *  - No existen días de gracia: GRACE_DAYS = 0 (sin días gratuitos).
 */

export const BOGOTA_TZ = "America/Bogota";
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
export const GRACE_DAYS = 0;

export interface LocalDate {
  y: number;
  m: number; // 1-12
  d: number;
}

export function toBogotaDate(instant: Date): LocalDate {
  const t = new Date(instant.getTime() + BOGOTA_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Suma meses a una fecha local conservando el día ancla y ajustando al último día disponible. */
export function addMonthsAnchored(base: LocalDate, months: number, anchorDay: number): LocalDate {
  if (!Number.isInteger(months) || months < 0) throw new Error("months debe ser entero >= 0");
  if (anchorDay < 1 || anchorDay > 31) throw new Error("anchorDay fuera de rango");
  const zeroBased = base.m - 1 + months;
  const y = base.y + Math.floor(zeroBased / 12);
  const m = (zeroBased % 12) + 1;
  return { y, m, d: Math.min(anchorDay, daysInMonth(y, m)) };
}

/** Último milisegundo del día civil indicado, en hora de Bogotá, expresado como instante UTC. */
export function endOfBogotaDay(ld: LocalDate): Date {
  return new Date(Date.UTC(ld.y, ld.m - 1, ld.d, 23, 59, 59, 999) - BOGOTA_OFFSET_MS);
}

export interface PeriodInput {
  /** Momento en que el proveedor confirmó el pago (fuente: servidor, no el navegador). */
  paidAt: Date;
  /** Vencimiento de la vigencia actual, si existe. */
  currentEnd?: Date | null;
  /** Día ancla actual, si existe. */
  anchorDay?: number | null;
}

export interface Period {
  start: Date;
  end: Date;
  anchorDay: number;
  continuation: boolean;
}

export function computeNextPeriod({ paidAt, currentEnd, anchorDay }: PeriodInput): Period {
  if (currentEnd && anchorDay && paidAt.getTime() <= currentEnd.getTime()) {
    const endLocal = addMonthsAnchored(toBogotaDate(currentEnd), 1, anchorDay);
    return {
      start: new Date(currentEnd.getTime() + 1),
      end: endOfBogotaDay(endLocal),
      anchorDay,
      continuation: true,
    };
  }
  const startLocal = toBogotaDate(paidAt);
  const newAnchor = startLocal.d;
  return {
    start: paidAt,
    end: endOfBogotaDay(addMonthsAnchored(startLocal, 1, newAnchor)),
    anchorDay: newAnchor,
    continuation: false,
  };
}

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: BOGOTA_TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: BOGOTA_TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatBogotaDate(d: Date): string {
  return dateFmt.format(d);
}
export function formatBogotaDateTime(d: Date): string {
  return `${dateTimeFmt.format(d)} (hora de Colombia)`;
}

export function daysUntil(target: Date, now: Date): number {
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

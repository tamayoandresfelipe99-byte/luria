/**
 * Producto y dinero. El precio autoritativo vive en la tabla `products` de la base de datos;
 * este valor es la semilla y el valor por defecto documentado. El navegador NUNCA define el precio.
 */
export const PRODUCT = {
  sku: "luria-mensual",
  name: "LURIA — suscripción mensual",
  priceCop: 40_000,
  currency: "COP",
  periodMonths: 1,
} as const;

export type Currency = "COP";

export function copToCents(cop: number): number {
  if (!Number.isSafeInteger(cop) || cop <= 0) throw new Error("Valor COP inválido");
  return cop * 100;
}

export function centsToCop(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents % 100 !== 0) throw new Error("Centavos inválidos para COP");
  return cents / 100;
}

const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCop(cop: number): string {
  return copFmt.format(cop);
}

/** Referencia de pedido única y no adivinable: LUR-AAAAMMDD-XXXXXXXXXX */
export function newOrderReference(now: Date, random: () => string): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const r = random().replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10);
  if (r.length < 10) throw new Error("Aleatoriedad insuficiente para la referencia");
  return `LUR-${y}${m}${d}-${r}`;
}

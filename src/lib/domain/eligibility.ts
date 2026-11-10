export interface EligibilityInput {
  platform: "zajuna" | "otra";
  browser: "chrome" | "edge" | "firefox" | "safari" | "otro";
  device: "escritorio" | "portatil" | "tableta" | "celular";
  virtualOnly: "si" | "no";
}

export type EligibilityResult = "verificado" | "en_prueba" | "no_compatible";

/**
 * Clasifica la elegibilidad. "verificado" solo si existe al menos un entorno verificado con evidencia
 * (SUPPORTED_ENVIRONMENTS_VERIFIED). Mientras no exista, el mejor resultado posible es "en_prueba",
 * que NO habilita la compra (A15).
 */
export function classifyEligibility(i: EligibilityInput, environmentsVerified: boolean): { result: EligibilityResult; message: string } {
  if (i.device === "celular" || i.device === "tableta")
    return { result: "no_compatible", message: "LURIA requiere Google Chrome en un computador. No funciona en celulares ni tabletas. Si tienes un computador, repite la verificación desde ahí." };
  if (i.browser !== "chrome")
    return { result: "no_compatible", message: "LURIA es una extensión de Google Chrome. Instala Chrome en tu computador y vuelve a verificar." };
  if (i.platform !== "zajuna")
    return { result: "no_compatible", message: "Por ahora LURIA solo está diseñada para el entorno ZAJUNA. No podemos ofrecerte la compra." };
  if (i.virtualOnly !== "si")
    return { result: "no_compatible", message: "LURIA está dirigida a instructores que imparten formación exclusivamente virtual. No podemos confirmar que te sea útil." };
  if (!environmentsVerified)
    return { result: "en_prueba", message: "Tu configuración coincide con el entorno de referencia, pero la compatibilidad exacta aún está en verificación técnica. Te avisaremos cuando la compra esté disponible." };
  return { result: "verificado", message: "Tu configuración coincide con un entorno verificado. Puedes continuar con la compra." };
}

/** Vigencia de una verificación para habilitar la compra. */
export const ELIGIBILITY_VALID_DAYS = 30;

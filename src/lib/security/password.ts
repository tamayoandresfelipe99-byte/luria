/**
 * Política de contraseñas (decisión del propietario, 12-nov-2026):
 *  - Entre 10 y 128 caracteres, sin reglas de composición (no se exige mayúscula, número ni símbolo).
 *  - Única condición adicional: no puede ser el nombre ni el apellido de la persona,
 *    aunque se le agreguen números, espacios o símbolos (p. ej. «Gomez12345» o «andres felipe!»).
 * La contraseña nunca se guarda ni se registra en esta aplicación: el hash (bcrypt) lo gestiona Supabase Auth.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN} caracteres. No puede ser tu nombre ni tu apellido. No uses tu contraseña de ZAJUNA.`;

/** Minúsculas, sin tildes y solo letras, para que «María», «maria» y «MARÍA!» se comparen igual. */
function lettersOnly(s: string) {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-zñ]/g, "");
}

/** Devuelve un mensaje en español si la contraseña no es aceptable; null si lo es. */
export function passwordProblem(password: string, ctx: { name?: string | null } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Usa al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `Usa como máximo ${PASSWORD_MAX} caracteres.`;
  const nameParts = (ctx.name ?? "").split(/\s+/).map(lettersOnly).filter((x) => x.length >= 3);
  if (nameParts.length > 0) {
    // Se quitan del texto los nombres y apellidos; si no queda ninguna otra letra, la contraseña es solo el nombre.
    let rest = lettersOnly(password);
    for (const part of [...nameParts].sort((a, b) => b.length - a.length)) rest = rest.split(part).join("");
    if (rest.length === 0) return "La contraseña no puede ser tu nombre ni tu apellido.";
  }
  return null;
}

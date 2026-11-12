/**
 * Política de contraseñas (NIST SP 800-63B, OWASP ASVS 2.1):
 *  - Longitud mínima de 10 caracteres (decisión del propietario, 12-nov-2026; NIST sugiere 15 sin MFA) y máxima
 *    amplia (128) para admitir frases. Las listas de rechazo y la consulta de filtraciones compensan la menor longitud.
 *  - Sin reglas de composición arbitrarias (no se exige «mayúscula, número y símbolo»).
 *  - Se rechazan contraseñas triviales, repetitivas o que contienen datos de la propia cuenta.
 *  - En el servidor se consulta además si aparece en filtraciones conocidas (k-anonimato, ver `isBreachedPassword`).
 * La contraseña nunca se guarda ni se registra en esta aplicación: el hash (bcrypt) lo gestiona Supabase Auth.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN} caracteres. Puedes usar una frase, por ejemplo cuatro palabras. No uses tu contraseña de ZAJUNA.`;

const TRIVIAL = [
  "password", "contrasena", "contraseña", "qwerty", "asdfgh", "zxcvbn", "123456", "abcdef", "iloveyou", "admin",
  "luria", "zajuna", "sena", "colombia", "bienvenido", "welcome", "letmein",
];

/** Minúsculas y sin tildes, para que «María» y «maria» se comparen igual. */
function normalize(s: string) {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Devuelve un mensaje en español si la contraseña no es aceptable; null si lo es. */
export function passwordProblem(password: string, ctx: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Usa al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `Usa como máximo ${PASSWORD_MAX} caracteres.`;
  const p = normalize(password);
  const compact = p.replace(/[\s\-_.!¡?¿*]+/g, "");
  if (new Set(compact).size < 5) return "La contraseña es demasiado repetitiva.";
  if (/^\d+$/.test(compact) || "01234567890123456789".includes(compact) || "98765432109876543210".includes(compact))
    return "No uses solo números ni secuencias.";
  // Contraseñas formadas casi solo por palabras triviales repetidas («passwordpassword…»).
  let rest = compact;
  for (const w of TRIVIAL) rest = rest.split(w).join("");
  if (rest.replace(/\d/g, "").length < 4) return "La contraseña es demasiado común.";
  const local = ctx.email ? normalize(ctx.email.split("@")[0] ?? "") : "";
  if (local.length >= 4 && compact.includes(local.replace(/[^a-z0-9]/g, ""))) return "No incluyas tu correo en la contraseña.";
  const nameParts = ctx.name ? normalize(ctx.name).split(/\s+/).filter((x) => x.length >= 4) : [];
  let withoutName = compact;
  for (const n of nameParts) withoutName = withoutName.split(n).join("");
  if (nameParts.length > 0 && withoutName.length < 8) return "No uses tu nombre como contraseña.";
  return null;
}

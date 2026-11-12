/**
 * Opciones de las cookies de sesión de Supabase. La aplicación solo usa Supabase desde el servidor,
 * así que la sesión no necesita ser legible por JavaScript: HttpOnly impide que un XSS robe el token.
 * Secure en HTTPS; SameSite=Lax limita el envío entre sitios (además de la verificación de Origin).
 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
};

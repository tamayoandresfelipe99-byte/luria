/**
 * Mensajes de autenticación neutrales: nunca revelan si un correo está registrado (A16).
 */
export function recoverAccountMessage(_emailExists: boolean): string {
  return "Si el correo corresponde a una cuenta, recibirás un enlace para restablecer tu contraseña. El enlace vence en una hora.";
}

export function loginErrorMessage(): string {
  return "Correo o contraseña incorrectos.";
}

export function registerDoneMessage(): string {
  return "Revisa tu correo para confirmar la cuenta. Si ya tenías una cuenta, puedes iniciar sesión o recuperar el acceso.";
}

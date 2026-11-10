"use client";
import { useActionState, useEffect } from "react";
import Link from "next/link";
import { registerAction, type FormState } from "../auth-actions";
import { track } from "@/components/Analytics";

function Err({ e }: { e?: string[] }) {
  return e?.length ? <span className="error">{e[0]}</span> : null;
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});
  useEffect(() => track("signup_start"), []);
  useEffect(() => { if (state.ok) track("signup_done"); }, [state.ok]);
  if (state.ok) return <div className="notice notice-ok" role="status">{state.message}</div>;
  const fe = state.fieldErrors ?? {};
  return (
    <form className="form" action={action} noValidate>
      {state.message && <p className="error" role="alert">{state.message}</p>}
      <div className="field">
        <label htmlFor="name">Nombre completo</label>
        <input id="name" name="name" type="text" autoComplete="name" required aria-invalid={!!fe.name} />
        <Err e={fe.name} />
      </div>
      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe.email} />
        <span className="hint">Usa un correo personal. No uses credenciales institucionales.</span>
        <Err e={fe.email} />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} aria-invalid={!!fe.password} aria-describedby="pwd-hint" />
        <span id="pwd-hint" className="hint">Mínimo 10 caracteres, con letras y números. No uses tu contraseña de ZAJUNA.</span>
        <Err e={fe.password} />
      </div>
      <div className="field">
        <label htmlFor="phone">Celular (opcional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="3001234567" aria-invalid={!!fe.phone} />
        <span className="hint">Solo para atención de soporte.</span>
        <Err e={fe.phone} />
      </div>
      <label className="checkbox"><input type="checkbox" name="acceptTerms" required /> <span>Acepto los <Link href="/legal/terminos" target="_blank">términos y condiciones</Link>.</span></label>
      <Err e={fe.acceptTerms} />
      <label className="checkbox"><input type="checkbox" name="acceptPrivacy" required /> <span>Leí y acepto el <Link href="/legal/privacidad" target="_blank">aviso de privacidad y tratamiento de datos</Link>.</span></label>
      <Err e={fe.acceptPrivacy} />
      <label className="checkbox"><input type="checkbox" name="marketing" /> <span>Quiero recibir novedades y ofertas de LURIA (opcional; puedes retirarlo cuando quieras).</span></label>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creando…" : "Crear cuenta"}</button>
    </form>
  );
}

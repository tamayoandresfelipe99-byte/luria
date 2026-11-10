"use client";
import { useActionState } from "react";
import { loginAction, type FormState } from "../auth-actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form className="form" action={action}>
      {state.message && <p className="error" role="alert">{state.message}</p>}
      <input type="hidden" name="siguiente" value={next} />
      <div className="field">
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}

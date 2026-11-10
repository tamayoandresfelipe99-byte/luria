"use client";
import { useActionState } from "react";
import { recoverAction, type FormState } from "../auth-actions";

export default function RecuperarPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(recoverAction, {});
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <h1>Recuperar acceso</h1>
        <div className="card">
          {state.ok ? (
            <p role="status">{state.message}</p>
          ) : (
            <form className="form" action={action}>
              <div className="field">
                <label htmlFor="email">Correo de tu cuenta</label>
                <input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <button className="btn btn-primary" disabled={pending}>Enviar enlace</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

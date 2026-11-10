"use client";
import { useActionState } from "react";
import { resetPasswordAction, type FormState } from "../auth-actions";

export default function RestablecerPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <h1>Nueva contraseña</h1>
        <div className="card">
          <form className="form" action={action}>
            {state.message && <p className="error" role="alert">{state.message}</p>}
            <div className="field"><label htmlFor="password">Nueva contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></div>
            <div className="field"><label htmlFor="confirm">Repite la contraseña</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
            <button className="btn btn-primary" disabled={pending}>Guardar</button>
          </form>
        </div>
      </div>
    </section>
  );
}

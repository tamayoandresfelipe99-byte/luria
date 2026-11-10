"use client";
import { useActionState } from "react";
import { updateProfileAction, type ProfileState } from "./actions";

export function ProfileForm({ name, phone, marketing }: { name: string; phone: string; marketing: boolean }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfileAction, {});
  return (
    <form className="form" action={action}>
      <div className="field"><label htmlFor="pf-name">Nombre</label><input id="pf-name" name="name" type="text" defaultValue={name} required /></div>
      <div className="field"><label htmlFor="pf-phone">Celular (opcional)</label><input id="pf-phone" name="phone" type="tel" defaultValue={phone} /></div>
      <label className="checkbox"><input type="checkbox" name="marketing" defaultChecked={marketing} /> <span>Recibir novedades y ofertas. Si lo desmarcas, dejaremos de enviarte promociones.</span></label>
      <button className="btn btn-ghost" disabled={pending}>Guardar cambios</button>
      {state.message && <p role="status" className={state.ok ? "" : "error"}>{state.message}</p>}
    </form>
  );
}

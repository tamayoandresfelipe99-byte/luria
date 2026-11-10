"use client";
import { useState } from "react";

export function SupportForm() {
  const [state, setState] = useState<{ ok?: boolean; msg?: string; busy?: boolean }>({});
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setState({ busy: true });
    const fd = new FormData(form);
    const r = await fetch("/api/soporte", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd.entries())) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (r.ok) {
      form.reset();
      setState({ ok: true, msg: "Recibimos tu solicitud. Puedes consultar su estado en esta página." });
    } else setState({ ok: false, msg: j.error ?? "No pudimos registrar la solicitud." });
  }
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="category">Tema</label>
        <select id="category" name="category" required>
          <option value="compra">Compra</option>
          <option value="instalacion">Instalación</option>
          <option value="compatibilidad">Compatibilidad</option>
          <option value="pago">Pago</option>
          <option value="renovacion">Renovación</option>
          <option value="tecnica">Incidencia técnica</option>
          <option value="otra">Otra</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="description">Describe el problema</label>
        <textarea id="description" name="description" required minLength={10} maxLength={2000} aria-describedby="desc-hint" />
        <span id="desc-hint" className="hint">No incluyas contraseñas ni datos de aprendices.</span>
      </div>
      <button className="btn btn-primary" disabled={state.busy}>{state.busy ? "Enviando…" : "Enviar"}</button>
      {state.msg && <p role="status" className={state.ok ? "" : "error"}>{state.msg}</p>}
    </form>
  );
}

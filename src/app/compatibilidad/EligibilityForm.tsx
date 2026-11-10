"use client";
import { useState } from "react";
import Link from "next/link";
import { track } from "@/components/Analytics";

type Result = { result: "verificado" | "en_prueba" | "no_compatible" | "desconocido"; message: string };

export function EligibilityForm() {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/elegibilidad", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fd.entries())),
      });
      if (!r.ok) throw new Error();
      setRes(await r.json());
      track("compat_check");
    } catch {
      setError("No pudimos verificar en este momento. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="platform">Plataforma en la que impartes formación</label>
        <select id="platform" name="platform" required defaultValue="zajuna">
          <option value="zajuna">ZAJUNA</option>
          <option value="otra">Otra</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="domain">Dirección web de tu plataforma (opcional)</label>
        <input id="domain" name="domain" type="text" inputMode="url" placeholder="ej.: zajuna..." />
      </div>
      <div className="field">
        <label htmlFor="browser">Navegador que usas</label>
        <select id="browser" name="browser" required defaultValue="chrome">
          <option value="chrome">Google Chrome</option>
          <option value="edge">Microsoft Edge</option>
          <option value="firefox">Firefox</option>
          <option value="safari">Safari</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="device">Dispositivo</label>
        <select id="device" name="device" required defaultValue="portatil">
          <option value="escritorio">Computador de escritorio</option>
          <option value="portatil">Computador portátil</option>
          <option value="tableta">Tableta</option>
          <option value="celular">Celular</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="virtualOnly">¿Impartes formación exclusivamente virtual?</label>
        <select id="virtualOnly" name="virtualOnly" required defaultValue="si">
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Verificando…" : "Verificar"}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {res && (
        <div className={`notice ${res.result === "verificado" ? "notice-ok" : res.result === "no_compatible" ? "notice-err" : "notice-warn"}`} role="status">
          <p style={{ margin: 0 }}>{res.message}</p>
          {res.result === "verificado" && <p style={{ margin: "8px 0 0" }}><Link href="/precio">Continuar a precio y compra →</Link></p>}
        </div>
      )}
    </form>
  );
}

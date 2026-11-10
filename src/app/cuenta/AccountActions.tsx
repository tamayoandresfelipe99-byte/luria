"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountActions({ cancelAtPeriodEnd, periodEnd }: { cancelAtPeriodEnd: boolean; periodEnd: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const end = periodEnd ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long" }).format(new Date(periodEnd)) : "";

  async function call(action: "cancel" | "resume") {
    setBusy(true);
    const r = await fetch("/api/cuenta/renovacion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(false);
    setConfirming(false);
    if (r.ok) router.refresh();
    else setMsg("No pudimos actualizar la renovación. Inténtalo de nuevo.");
  }

  if (cancelAtPeriodEnd)
    return <div><button className="btn btn-ghost" disabled={busy} onClick={() => call("resume")}>Reanudar renovaciones</button>{msg && <p className="error">{msg}</p>}</div>;
  return (
    <div className="stack">
      {!confirming ? (
        <button className="btn btn-danger" onClick={() => setConfirming(true)}>Cancelar cobros futuros</button>
      ) : (
        <div className="notice notice-warn" role="alertdialog" aria-labelledby="cc-t">
          <strong id="cc-t">¿Cancelar las renovaciones?</strong>
          <p>Conservarás el acceso hasta el {end}. Después no se renovará.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-danger" disabled={busy} onClick={() => call("cancel")}>Sí, cancelar renovaciones</button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Volver</button>
          </div>
        </div>
      )}
      {msg && <p className="error" role="alert">{msg}</p>}
    </div>
  );
}

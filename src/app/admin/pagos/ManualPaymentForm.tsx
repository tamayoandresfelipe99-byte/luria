"use client";
import { useState } from "react";

export function ManualPaymentForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const paidLocal = String(fd.get("paidAt"));
    const r = await fetch("/api/admin/pagos-manuales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderReference: String(fd.get("orderReference")).trim().toUpperCase(),
        method: fd.get("method"),
        externalReference: fd.get("externalReference"),
        amountCop: Number(fd.get("amountCop")),
        paidAt: new Date(`${paidLocal}:00-05:00`).toISOString(),
        evidenceNote: fd.get("evidenceNote"),
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { outcome?: string; error?: string };
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Resultado: ${j.outcome}` } : { ok: false, text: j.error ?? "Error" });
  }
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field"><label htmlFor="mp-ref">Referencia del pedido (LUR-…)</label><input id="mp-ref" name="orderReference" type="text" required pattern="LUR-\d{8}-[A-Za-z0-9]{10}" /></div>
      <div className="field"><label htmlFor="mp-method">Medio</label><select id="mp-method" name="method"><option value="nequi">Nequi</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></div>
      <div className="field"><label htmlFor="mp-ext">Referencia de la transacción en el medio de pago</label><input id="mp-ext" name="externalReference" type="text" required minLength={4} /></div>
      <div className="field"><label htmlFor="mp-amount">Valor recibido (COP)</label><input id="mp-amount" name="amountCop" type="number" required min={1} step={1} /></div>
      <div className="field"><label htmlFor="mp-date">Fecha y hora del pago (hora de Colombia)</label><input id="mp-date" name="paidAt" type="datetime-local" required /></div>
      <div className="field"><label htmlFor="mp-note">Evidencia de verificación</label><textarea id="mp-note" name="evidenceNote" required minLength={10} placeholder="Ej.: verificado en el historial de Nequi Negocios, movimiento del 10/11 a las 9:41 por $40.000." /></div>
      <button className="btn btn-primary" disabled={busy}>Registrar pago verificado</button>
      {msg && <p role="status" className={msg.ok ? "" : "error"}>{msg.text}</p>}
    </form>
  );
}

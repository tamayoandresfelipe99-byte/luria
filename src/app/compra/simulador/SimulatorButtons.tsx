"use client";
import { useState } from "react";

export function SimulatorButtons({ reference }: { reference: string }) {
  const [busy, setBusy] = useState(false);
  async function go(status: "APPROVED" | "DECLINED" | "PENDING") {
    setBusy(true);
    await fetch("/api/compra/simulador", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, status }) });
    window.location.assign(`/pago/resultado?referencia=${encodeURIComponent(reference)}`);
  }
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button className="btn btn-accent" disabled={busy} onClick={() => go("APPROVED")}>Simular pago aprobado</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => go("PENDING")}>Simular pago pendiente</button>
      <button className="btn btn-danger" disabled={busy} onClick={() => go("DECLINED")}>Simular rechazo</button>
    </div>
  );
}

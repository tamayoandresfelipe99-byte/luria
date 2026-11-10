"use client";
import { useState } from "react";
import Link from "next/link";
import { track } from "@/components/Analytics";

export function CheckoutForm({ simulated }: { simulated: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("terms") || !fd.get("desktop")) {
      setError("Debes aceptar las condiciones y confirmar el requisito de computador.");
      return;
    }
    setBusy(true);
    setError(null);
    track("checkout_start");
    const r = await fetch("/api/compra", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acceptPurchaseTerms: true, acknowledgedDesktop: true, idempotencyKey: key }),
    });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (r.ok && j.url) window.location.assign(j.url);
    else {
      setBusy(false);
      setError(j.error ?? "No pudimos iniciar el pago.");
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h2 style={{ fontSize: "1.2rem" }}>Confirmación</h2>
      <label className="checkbox"><input type="checkbox" name="terms" /> <span>Leí y acepto las <Link href="/legal/condiciones-compra" target="_blank">condiciones de compra</Link>, incluida la información sobre retracto, reversión y renovación.</span></label>
      <label className="checkbox"><input type="checkbox" name="desktop" /> <span>Entiendo que LURIA se usa en Google Chrome en un computador y no en el celular.</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Preparando el pago…" : simulated ? "Continuar al simulador de pago" : "Continuar a la pasarela de pago"}</button>
    </form>
  );
}

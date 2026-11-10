"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Status = { view: "aprobado_activo" | "pago_recibido_activacion_pendiente" | "pendiente" | "rechazado" | "en_revision" | "no_encontrado"; message: string };

const UI: Record<Status["view"], { title: string; cls: string }> = {
  aprobado_activo: { title: "Pago aprobado · licencia activa", cls: "notice-ok" },
  pago_recibido_activacion_pendiente: { title: "Pago recibido · activación pendiente", cls: "notice-warn" },
  pendiente: { title: "Pago pendiente", cls: "notice-info" },
  rechazado: { title: "Pago rechazado", cls: "notice-err" },
  en_revision: { title: "Pago en revisión", cls: "notice-warn" },
  no_encontrado: { title: "Pedido no encontrado", cls: "notice-err" },
};

export function ResultPoller({ reference }: { reference: string }) {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const load = async () => {
      const r = await fetch(`/api/pago/estado?referencia=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const j = (await r.json()) as Status;
      if (alive) setS(j);
      return j;
    };
    void load();
    const id = setInterval(async () => {
      attempts += 1;
      const j = await load();
      if (j.view !== "pendiente" || attempts > 30) clearInterval(id);
    }, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [reference]);

  if (!s) return <p role="status">Consultando el estado verificado de tu pago…</p>;
  const ui = UI[s.view];
  return (
    <div className="stack">
      <div className={`notice ${ui.cls}`} role="status" aria-live="polite">
        <strong style={{ display: "block" }}>{ui.title}</strong>
        {s.message}
      </div>
      <p className="small muted">Referencia del pedido: <code>{reference}</code></p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href="/cuenta">Ir a mi cuenta</Link>
        {s.view === "rechazado" && <Link className="btn btn-ghost" href="/compra">Intentar de nuevo</Link>}
        {s.view === "aprobado_activo" && <Link className="btn btn-ghost" href="/instalacion">Instrucciones de instalación</Link>}
        <Link className="btn btn-ghost" href="/soporte">Soporte</Link>
      </div>
    </div>
  );
}

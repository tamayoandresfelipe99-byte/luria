"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TaskActions({ taskId, manualAllowed }: { taskId: string; manualAllowed: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  async function post(body: object) {
    const r = await fetch("/api/admin/activaciones", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setMsg(r.ok ? "Hecho" : j.error ?? "Error");
    if (r.ok) router.refresh();
  }
  return (
    <div className="stack small">
      <button className="btn btn-ghost" onClick={() => post({ action: "retry", taskId })}>Reintentar</button>
      {manualAllowed && !manual && <button className="btn btn-ghost" onClick={() => setManual(true)}>Registrar activación manual</button>}
      {manual && (
        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); void post({ action: "complete_manual", taskId, externalLicenseId: fd.get("ext"), note: fd.get("note") }); }} className="stack">
          <label>ID de licencia en el sistema de la extensión<input name="ext" type="text" required minLength={3} /></label>
          <label>Evidencia<textarea name="note" required minLength={10} /></label>
          <button className="btn btn-primary">Confirmar</button>
        </form>
      )}
      {msg && <span role="status">{msg}</span>}
    </div>
  );
}

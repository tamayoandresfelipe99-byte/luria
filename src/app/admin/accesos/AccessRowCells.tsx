"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccessStatus, PaymentState } from "@/lib/domain/access-delivery";
import { isPaid } from "@/lib/domain/access-delivery";

interface Props {
  userId: string;
  name: string;
  link: string | null;
  access: AccessStatus;
  payment: PaymentState;
  canManage: boolean;
}

/** Columnas «Enlace» y «Acciones» de una fila. Cada acción se valida de nuevo en el servidor. */
export function AccessRowCells({ userId, name, link, access, payment, canManage }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function post(body: object, okText: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/accesos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, ...body }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: j.error ?? "No fue posible completar la acción." });
    if (r.ok) {
      setRevoking(false);
      router.refresh();
    }
  }

  const canEnable = canManage && !!link && (access === "enlace_guardado" || access === "suspendido") && isPaid(payment);
  const paid = isPaid(payment);
  const enableHint = !paid
    ? payment === "vencido" ? "La suscripción no está vigente" : "Se habilita cuando el pago esté al día"
    : !link ? "Primero guarda el enlace" : access === "revocado" ? "Guarda de nuevo el enlace para habilitar" : undefined;
  const canRevoke = canManage && (access === "habilitado" || access === "enlace_guardado" || access === "suspendido");

  return (
    <>
      <td style={{ minWidth: 260 }}>
        {canManage ? (
          <form
            className="access-link-form"
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const url = String(new FormData(e.currentTarget).get("url") ?? "");
              void post({ action: "save_link", url }, access === "habilitado" ? "Enlace sustituido" : "Enlace guardado (aún no visible para el cliente)");
            }}
          >
            <label className="sr-only" htmlFor={`url-${userId}`}>Enlace de acceso de {name}</label>
            <input id={`url-${userId}`} name="url" type="url" inputMode="url" placeholder="https://…" defaultValue={link ?? ""} required pattern="https://.+" maxLength={2048} />
            <button className="btn btn-ghost btn-sm" disabled={busy}>Guardar enlace</button>
          </form>
        ) : link ? (
          <code className="access-link" title={link}>{link}</code>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <div className="access-actions">
          {canManage && access !== "habilitado" && paid && (
            <button className="btn btn-primary btn-sm" disabled={busy || !canEnable} title={canEnable ? undefined : enableHint} onClick={() => void post({ action: "enable" }, "Acceso habilitado y cliente notificado")}>
              Habilitar acceso
            </button>
          )}
          {canRevoke && !revoking && (
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setRevoking(true)}>Revocar</button>
          )}
          <Link className="btn btn-ghost btn-sm" href={`/admin/clientes/${userId}`}>Ver detalle</Link>
        </div>
        {revoking && (
          <form
            className="stack small"
            style={{ marginTop: 8 }}
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              void post({ action: "revoke", reason: String(new FormData(e.currentTarget).get("reason") ?? "") }, "Acceso revocado");
            }}
          >
            <label htmlFor={`reason-${userId}`}>Motivo de la revocación</label>
            <input id={`reason-${userId}`} name="reason" type="text" required minLength={5} maxLength={500} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-danger btn-sm" disabled={busy}>Confirmar revocación</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevoking(false)}>Cancelar</button>
            </div>
          </form>
        )}
        {!canEnable && canManage && access !== "habilitado" && enableHint && <p className="small muted" style={{ margin: "6px 0 0" }}>{enableHint}</p>}
        {msg && <p role="status" className={`small ${msg.ok ? "text-ok" : "text-err"}`} style={{ margin: "6px 0 0" }}>{msg.text}</p>}
      </td>
    </>
  );
}

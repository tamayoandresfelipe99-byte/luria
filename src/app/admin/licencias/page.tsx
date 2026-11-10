import { supabaseServer } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatBogotaDateTime } from "@/lib/domain/time";
import { appConfig } from "@/lib/services/factory";
import { TaskActions } from "./TaskActions";
import { Notice } from "@/components/Notices";

export default async function Licencias() {
  const { roles } = await requireRole(["admin", "soporte"], "/admin/licencias");
  const cfg = appConfig();
  const sb = await supabaseServer();
  const [{ data: tasks }, { data: lics }] = await Promise.all([
    sb.from("activation_tasks").select("id, kind, status, attempts, error_code, error_message, due_at, created_at").order("created_at", { ascending: false }).limit(100),
    sb.from("licenses").select("id, status, valid_until, external_license_id, last_synced_at").order("updated_at", { ascending: false }).limit(100),
  ]);
  const t = (tasks ?? []) as { id: string; kind: string; status: string; attempts: number; error_code: string | null; error_message: string | null; due_at: string | null; created_at: string }[];
  const l = (lics ?? []) as { id: string; status: string; valid_until: string | null; external_license_id: string | null; last_synced_at: string | null }[];
  const manualAllowed = cfg.licenseAdapter === "manual" && cfg.licenseManualRevocationConfirmed;
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem" }}>Licencias y activaciones</h1>
      <Notice kind={cfg.licenseAdapter === "pending" ? "warn" : "info"}>
        Mecanismo de licencias: <strong>{cfg.licenseAdapter}</strong>.{" "}
        {cfg.licenseAdapter === "pending" && "No hay integración con la extensión: cada pago aprobado genera una tarea de activación."}
        {cfg.licenseAdapter === "simulated" && "Licencias simuladas: no dan acceso real."}
        {!manualAllowed && " La activación manual está deshabilitada hasta confirmar un mecanismo real de vigencia y revocación."}
      </Notice>
      <h2 style={{ fontSize: "1.2rem" }}>Tareas</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Creada</th><th>Tipo</th><th>Estado</th><th>Intentos</th><th>Error</th><th>Vence</th><th>Acciones</th></tr></thead>
        <tbody>{t.map((x) => (
          <tr key={x.id}><td>{formatBogotaDateTime(new Date(x.created_at))}</td><td>{x.kind}</td><td>{x.status}</td><td>{x.attempts}</td><td>{x.error_code}<br /><span className="small muted">{x.error_message}</span></td><td>{x.due_at ? formatBogotaDateTime(new Date(x.due_at)) : "—"}</td>
            <td>{roles.includes("admin") && x.status !== "done" ? <TaskActions taskId={x.id} manualAllowed={manualAllowed && x.kind === "activation"} /> : "—"}</td></tr>
        ))}</tbody>
      </table></div>
      <h2 style={{ fontSize: "1.2rem" }}>Licencias</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Licencia externa</th><th>Estado</th><th>Válida hasta</th><th>Última sincronización</th></tr></thead>
        <tbody>{l.map((x) => <tr key={x.id}><td><code>{x.external_license_id ?? "—"}</code></td><td>{x.status}</td><td>{x.valid_until ? formatBogotaDateTime(new Date(x.valid_until)) : "—"}</td><td>{x.last_synced_at ? formatBogotaDateTime(new Date(x.last_synced_at)) : "—"}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

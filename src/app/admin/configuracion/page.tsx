import { requireRole } from "@/lib/auth";
import { appConfig } from "@/lib/services/factory";
import { dependencyStatus, realChargeBlockers } from "@/lib/config";

export default async function Configuracion() {
  await requireRole(["admin"], "/admin/configuracion");
  const cfg = appConfig();
  const deps = dependencyStatus(cfg);
  const blockers = realChargeBlockers(cfg);
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem" }}>Configuración y dependencias</h1>
      <p className="muted">Los valores se configuran mediante variables de entorno del servidor. Esta página no muestra secretos.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Dependencia</th><th>Estado</th><th>Detalle</th></tr></thead>
        <tbody>{deps.map((d) => <tr key={d.key}><td><code>{d.key}</code></td><td>{d.ok ? <span className="badge badge-ok">Listo</span> : <span className="badge badge-warn">Pendiente</span>}</td><td>{d.detail}</td></tr>)}</tbody>
      </table></div>
      <h2 style={{ fontSize: "1.2rem" }}>Cobros reales</h2>
      {blockers.length === 0 ? <p className="badge badge-ok">Habilitados</p> : <ul>{blockers.map((b) => <li key={b.key + b.message}><code>{b.key}</code>: {b.message}</li>)}</ul>}
    </div>
  );
}

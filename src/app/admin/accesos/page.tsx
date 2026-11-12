import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadAccessOverview, type AccessOverviewRow } from "@/lib/services/access";
import { isPaid, needsAccess } from "@/lib/domain/access-delivery";
import { formatBogotaDate } from "@/lib/domain/time";
import { AccessStatusBadge, PaymentStateBadge } from "@/components/AccessBadges";
import { AccessRowCells } from "./AccessRowCells";

export const dynamic = "force-dynamic";

const FILTERS: { id: string; label: string; test: (r: AccessOverviewRow) => boolean }[] = [
  { id: "todos", label: "Todos", test: () => true },
  { id: "pagaron-sin-acceso", label: "Pagaron, pero no tienen acceso", test: (r) => needsAccess(r.payment_state, r.access_status) },
  { id: "habilitados", label: "Acceso habilitado", test: (r) => r.access_status === "habilitado" && isPaid(r.payment_state) },
  { id: "por-vencer", label: "Próximos a vencer", test: (r) => r.payment_state === "por_vencer" },
  { id: "renovacion", label: "Requieren renovación", test: (r) => r.payment_state === "vencido" },
  { id: "sin-pago", label: "Registrados sin pago", test: (r) => r.payment_state === "pendiente_pago" || r.payment_state === "en_verificacion" },
];

export default async function Accesos({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  const { roles } = await requireRole(["admin", "soporte", "comercial"], "/admin/accesos");
  const canManage = roles.includes("admin");
  const { filtro, q } = await searchParams;
  const all = (await loadAccessOverview()).filter((r) => !r.is_staff);
  const active = FILTERS.find((f) => f.id === filtro) ?? FILTERS[0]!;
  const term = (q ?? "").trim().toLowerCase();
  const rows = all.filter((r) => active.test(r) && (!term || r.full_name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term)));
  const href = (id: string) => `/admin/accesos?filtro=${id}${term ? `&q=${encodeURIComponent(term)}` : ""}`;

  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem", marginBottom: 0 }}>Pagos y accesos</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        El estado de pago y la entrega del acceso son independientes. Un pago confirmado no habilita el acceso; un enlace guardado no lo ve el cliente
        hasta que presionas «Habilitar acceso».{!canManage && " Tu rol puede consultar, pero solo un administrador gestiona enlaces."}
      </p>

      <nav aria-label="Filtros" className="filter-chips">
        {FILTERS.map((f) => {
          const n = all.filter(f.test).length;
          const attention = f.id === "pagaron-sin-acceso" && n > 0;
          return (
            <Link key={f.id} href={href(f.id)} className={`chip${f.id === active.id ? " chip-on" : ""}${attention ? " chip-alert" : ""}`} aria-current={f.id === active.id ? "page" : undefined}>
              {f.label} <span className="chip-n">{n}</span>
            </Link>
          );
        })}
      </nav>

      <form style={{ display: "flex", gap: 8 }}>
        <input type="hidden" name="filtro" value={active.id} />
        <label htmlFor="q" className="sr-only">Buscar</label>
        <input id="q" name="q" type="text" placeholder="Buscar por nombre o correo" defaultValue={q} />
        <button className="btn btn-ghost">Buscar</button>
      </form>

      <div className="table-wrap">
        <table className="access-table">
          <thead>
            <tr><th>Usuario</th><th>Estado de pago</th><th>Vencimiento</th><th>Estado de acceso</th><th>Enlace</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className={needsAccess(r.payment_state, r.access_status) ? "row-attention" : undefined}>
                <td><strong>{r.full_name}</strong><br /><span className="small muted">{r.email}</span></td>
                <td><PaymentStateBadge state={r.payment_state} /></td>
                <td className="nowrap">{r.period_end ? formatBogotaDate(new Date(r.period_end)) : "—"}</td>
                <td>
                  <AccessStatusBadge status={r.access_status} />
                  {r.access_status === "habilitado" && r.enabled_at && (
                    <div className="small muted">{formatBogotaDate(new Date(r.enabled_at))}{r.enabled_by_name ? ` · ${r.enabled_by_name}` : ""}</div>
                  )}
                  {(r.access_status === "suspendido" || r.access_status === "revocado") && r.status_reason && <div className="small muted">{r.status_reason}</div>}
                </td>
                <AccessRowCells userId={r.user_id} name={r.full_name} link={r.link_url} access={r.access_status} payment={r.payment_state} canManage={canManage} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted">No hay clientes en este filtro.</p>}
      <p className="small muted">Cada acción queda en la auditoría con quién la hizo y cuándo. Al vencer la suscripción, el acceso se suspende solo; reactivarlo requiere que el pago esté al día.</p>
    </div>
  );
}

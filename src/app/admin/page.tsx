import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCop } from "@/lib/domain/money";
import { loadAccessOverview } from "@/lib/services/access";
import { needsAccess } from "@/lib/domain/access-delivery";

async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

export default async function AdminHome() {
  const sb = await supabaseServer();
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [users, active, pending, activations, expired, support, upcoming, approved] = await Promise.all([
    count(sb.from("profiles").select("id", head)),
    count(sb.from("subscriptions").select("id", head).eq("status", "active").gt("current_period_end", now.toISOString())),
    count(sb.from("orders").select("id", head).eq("status", "pending_payment")),
    count(sb.from("activation_tasks").select("id", head).in("status", ["open", "in_progress"])),
    count(sb.from("subscriptions").select("id", head).eq("status", "expired")),
    count(sb.from("support_requests").select("id", head).in("status", ["abierta", "en_proceso"])),
    count(sb.from("subscriptions").select("id", head).eq("status", "active").lte("current_period_end", soon).gt("current_period_end", now.toISOString())),
    sb.from("payments").select("amount_cents").eq("status", "approved").eq("discrepancy", false),
  ]);
  const rows = (approved.data ?? []) as { amount_cents: number }[];
  const overview = (await loadAccessOverview().catch(() => [])).filter((r) => !r.is_staff);
  const waiting = overview.filter((r) => needsAccess(r.payment_state, r.access_status)).length;
  const revenue = rows.reduce((a, r) => a + r.amount_cents, 0) / 100;
  const kpis: [string, string | number][] = [
    ["Usuarios registrados", users],
    ["Suscriptores activos", active],
    ["Ventas verificadas", rows.length],
    ["Ingresos verificados", formatCop(revenue)],
    ["Próximos a vencer (7 días)", upcoming],
    ["Pedidos pendientes de pago", pending],
    ["Activaciones pendientes", activations],
    ["Clientes vencidos", expired],
    ["Solicitudes de soporte abiertas", support],
  ];
  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>Vista general</h1>
      <Link href="/admin/accesos?filtro=pagaron-sin-acceso" className={`kpi kpi-feature${waiting > 0 ? " kpi-alert" : ""}`}>
        <div className="v">{waiting}</div>
        <div className="l">Clientes con pago confirmado y acceso pendiente</div>
        <div className="small">{waiting > 0 ? "Requieren que habilites su enlace → Ver «Pagaron, pero no tienen acceso»" : "Todos los clientes que pagaron tienen su acceso habilitado"}</div>
      </Link>
      <div className="kpis">{kpis.map(([l, v]) => <div className="kpi" key={l}><div className="v">{v}</div><div className="l">{l}</div></div>)}</div>
      <p className="small muted" style={{ marginTop: 16 }}>Los ingresos incluyen solo pagos aprobados y verificados sin discrepancias. No incluyen reembolsos ni pagos en revisión.</p>
    </>
  );
}

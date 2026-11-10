import { supabaseServer } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatCop } from "@/lib/domain/money";

export default async function Reportes() {
  await requireRole(["admin", "comercial"], "/admin/reportes");
  const sb = await supabaseServer();
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const [{ data: pays }, { data: events }, { data: canc }] = await Promise.all([
    sb.from("payments").select("created_at, amount_cents, status, discrepancy, orders(is_renewal)").gte("created_at", since),
    sb.from("analytics_events").select("event").gte("created_at", since),
    sb.from("subscriptions").select("canceled_at").not("canceled_at", "is", null).gte("canceled_at", since),
  ]);
  const months = new Map<string, { sales: number; revenue: number; renewals: number; refunds: number }>();
  const key = (iso: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).format(new Date(iso));
  for (const p of (pays ?? []) as unknown as { created_at: string; amount_cents: number; status: string; discrepancy: boolean; orders: { is_renewal: boolean } }[]) {
    const m = months.get(key(p.created_at)) ?? { sales: 0, revenue: 0, renewals: 0, refunds: 0 };
    if (p.status === "approved" && !p.discrepancy) { m.sales++; m.revenue += p.amount_cents / 100; if (p.orders.is_renewal) m.renewals++; }
    if (p.status === "refunded" || p.status === "reversed") m.refunds++;
    months.set(key(p.created_at), m);
  }
  const funnel = new Map<string, number>();
  for (const e of (events ?? []) as { event: string }[]) funnel.set(e.event, (funnel.get(e.event) ?? 0) + 1);
  const steps = ["page_view", "pricing_view", "compat_check", "signup_start", "signup_done", "checkout_start", "payment_verified", "activation_done"];
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem" }}>Reportes (últimos 6 meses)</h1>
      <h2 style={{ fontSize: "1.2rem" }}>Ventas y renovaciones</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Mes</th><th>Ventas verificadas</th><th>Renovaciones</th><th>Ingresos</th><th>Reembolsos/reversiones</th></tr></thead>
        <tbody>{[...months.entries()].sort().map(([m, v]) => <tr key={m}><td>{m}</td><td>{v.sales}</td><td>{v.renewals}</td><td>{formatCop(v.revenue)}</td><td>{v.refunds}</td></tr>)}</tbody>
      </table></div>
      {months.size === 0 && <p className="muted">Sin ventas registradas en este entorno.</p>}
      <h2 style={{ fontSize: "1.2rem" }}>Embudo de conversión (eventos anónimos con consentimiento)</h2>
      <div className="table-wrap"><table><thead><tr><th>Paso</th><th>Eventos</th></tr></thead><tbody>{steps.map((s) => <tr key={s}><td>{s}</td><td>{funnel.get(s) ?? 0}</td></tr>)}</tbody></table></div>
      <p className="small muted">Cancelaciones de renovación en el período: {(canc ?? []).length}. La analítica es independiente de los registros financieros y solo cuenta visitantes que aceptaron la medición.</p>
    </div>
  );
}

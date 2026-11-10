import { supabaseServer } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatBogotaDateTime } from "@/lib/domain/time";
import { formatCop } from "@/lib/domain/money";
import { PAYMENT_LABELS, type PaymentStatus } from "@/lib/domain/states";
import { ManualPaymentForm } from "./ManualPaymentForm";

export default async function Pagos() {
  const { roles } = await requireRole(["admin", "comercial"], "/admin/pagos");
  const sb = await supabaseServer();
  const [{ data: pays }, { data: events }] = await Promise.all([
    sb.from("payments").select("id, created_at, provider, provider_transaction_id, amount_cents, status, method, discrepancy, orders(reference)").order("created_at", { ascending: false }).limit(100),
    sb.from("payment_events").select("received_at, provider, event_type, processing_status, note").in("processing_status", ["review", "error", "rejected"]).order("received_at", { ascending: false }).limit(50),
  ]);
  const rows = (pays ?? []) as unknown as { id: string; created_at: string; provider: string; provider_transaction_id: string; amount_cents: number; status: PaymentStatus; method: string | null; discrepancy: boolean; orders: { reference: string } }[];
  const ev = (events ?? []) as { received_at: string; provider: string; event_type: string; processing_status: string; note: string | null }[];
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem" }}>Pagos</h1>
      <div className="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Pedido</th><th>Proveedor</th><th>Transacción</th><th>Valor</th><th>Estado</th><th>Conciliación</th></tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.id}><td>{formatBogotaDateTime(new Date(p.created_at))}</td><td><code>{p.orders.reference}</code></td><td>{p.provider}{p.method ? ` · ${p.method}` : ""}</td><td><code>{p.provider_transaction_id}</code></td><td>{formatCop(p.amount_cents / 100)}</td><td>{PAYMENT_LABELS[p.status]}</td><td>{p.discrepancy ? <span className="badge badge-err">Discrepancia</span> : <span className="badge badge-ok">Conciliado</span>}</td></tr>
        ))}</tbody>
      </table></div>
      {roles.includes("admin") && (
        <>
          <h2 style={{ fontSize: "1.25rem" }}>Eventos que requieren revisión</h2>
          {ev.length === 0 ? <p className="muted">No hay eventos pendientes de revisión.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Recibido</th><th>Proveedor</th><th>Tipo</th><th>Estado</th><th>Nota</th></tr></thead><tbody>
              {ev.map((e, i) => <tr key={i}><td>{formatBogotaDateTime(new Date(e.received_at))}</td><td>{e.provider}</td><td>{e.event_type}</td><td>{e.processing_status}</td><td>{e.note}</td></tr>)}
            </tbody></table></div>
          )}
          <div className="card">
            <h2 style={{ fontSize: "1.25rem" }}>Registrar pago manual con evidencia</h2>
            <p className="small muted">Solo para pagos recibidos fuera de la pasarela (p. ej. Nequi en la transición). Un comprobante enviado por chat no basta: verifica el ingreso en el extracto o la app del comercio antes de registrar. Cada registro queda auditado y la referencia externa no puede reutilizarse.</p>
            <ManualPaymentForm />
          </div>
          <p className="small muted">Reembolsos y reversiones: se procesan en la pasarela y llegan como eventos verificados; la licencia se revoca automáticamente o se crea una tarea de revocación.</p>
        </>
      )}
    </div>
  );
}

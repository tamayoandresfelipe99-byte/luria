import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { formatBogotaDateTime } from "@/lib/domain/time";
import { formatCop } from "@/lib/domain/money";

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const [{ data: p }, { data: sub }, { data: orders }, { data: support }, { data: consents }, { data: attr }] = await Promise.all([
    sb.from("profiles").select("full_name, email, phone, created_at").eq("id", id).maybeSingle(),
    sb.from("subscriptions").select("status, current_period_start, current_period_end, cancel_at_period_end").eq("user_id", id).maybeSingle(),
    sb.from("orders").select("reference, status, amount_cop, created_at, payments(status, provider, method, discrepancy)").eq("user_id", id).order("created_at", { ascending: false }),
    sb.from("support_requests").select("category, status, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    sb.from("consents").select("purpose, granted, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    sb.from("attribution").select("channel, campaign").eq("user_id", id).maybeSingle(),
  ]);
  if (!p) notFound();
  const prof = p as { full_name: string; email: string; phone: string | null; created_at: string };
  const s = sub as { status: string; current_period_start: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;
  const ords = (orders ?? []) as unknown as { reference: string; status: string; amount_cop: number; created_at: string; payments: { status: string; provider: string; method: string | null; discrepancy: boolean }[] }[];
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem" }}>{prof.full_name}</h1>
      <div className="grid grid-2">
        <div className="card card-flat">
          <h2 style={{ fontSize: "1.1rem" }}>Cuenta</h2>
          <p>{prof.email}<br />{prof.phone ?? "Sin teléfono"}<br />Registro: {formatBogotaDateTime(new Date(prof.created_at))}<br />Canal: {(attr as { channel: string } | null)?.channel ?? "—"}</p>
        </div>
        <div className="card card-flat">
          <h2 style={{ fontSize: "1.1rem" }}>Suscripción</h2>
          {s ? <p>Estado: {s.status}{s.cancel_at_period_end ? " (no se renovará)" : ""}<br />Vence: {s.current_period_end ? formatBogotaDateTime(new Date(s.current_period_end)) : "—"}</p> : <p className="muted">Sin suscripción.</p>}
        </div>
      </div>
      <div className="card card-flat">
        <h2 style={{ fontSize: "1.1rem" }}>Historial</h2>
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Pedido</th><th>Valor</th><th>Pedido</th><th>Pago</th></tr></thead><tbody>
          {ords.map((o) => <tr key={o.reference}><td>{formatBogotaDateTime(new Date(o.created_at))}</td><td><code>{o.reference}</code></td><td>{formatCop(o.amount_cop)}</td><td>{o.status}</td><td>{o.payments.map((x) => `${x.status} · ${x.method ?? x.provider}${x.discrepancy ? " · DISCREPANCIA" : ""}`).join("; ") || "—"}</td></tr>)}
        </tbody></table></div>
      </div>
      <div className="grid grid-2">
        <div className="card card-flat"><h2 style={{ fontSize: "1.1rem" }}>Incidencias</h2><ul>{((support ?? []) as { category: string; status: string; created_at: string }[]).map((r, i) => <li key={i}>{r.category} · {r.status} · {formatBogotaDateTime(new Date(r.created_at))}</li>)}</ul></div>
        <div className="card card-flat"><h2 style={{ fontSize: "1.1rem" }}>Consentimientos</h2><ul>{((consents ?? []) as { purpose: string; granted: boolean; created_at: string }[]).map((c, i) => <li key={i}>{c.purpose}: {c.granted ? "otorgado" : "no otorgado / retirado"} · {formatBogotaDateTime(new Date(c.created_at))}</li>)}</ul></div>
      </div>
    </div>
  );
}

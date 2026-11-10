import { supabaseServer } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatCop } from "@/lib/domain/money";

export default async function Comercial() {
  await requireRole(["admin", "comercial"], "/admin/comercial");
  const sb = await supabaseServer();
  const [{ data: attr }, { data: refs }, { data: com }] = await Promise.all([
    sb.from("attribution").select("channel, referrer_id"),
    sb.from("referrers").select("id, code, display_name, authorized, commission_pct"),
    sb.from("commissions").select("referrer_id, amount_cop, status"),
  ]);
  const byChannel = new Map<string, number>();
  for (const a of (attr ?? []) as { channel: string }[]) byChannel.set(a.channel, (byChannel.get(a.channel) ?? 0) + 1);
  const commissions = (com ?? []) as { referrer_id: string; amount_cop: number; status: string }[];
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem" }}>Gestión comercial</h1>
      <h2 style={{ fontSize: "1.2rem" }}>Fuente de adquisición (clientes registrados)</h2>
      <div className="kpis">{[...byChannel.entries()].map(([c, n]) => <div key={c} className="kpi"><div className="v">{n}</div><div className="l">{c}</div></div>)}</div>
      {byChannel.size === 0 && <p className="muted">Sin datos de atribución todavía.</p>}
      <h2 style={{ fontSize: "1.2rem" }}>Referidos y comisiones</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Autorizado</th><th>%</th><th>Atribuibles</th><th>Recibidas</th><th>Anuladas</th></tr></thead>
        <tbody>{((refs ?? []) as { id: string; code: string; display_name: string; authorized: boolean; commission_pct: number | null }[]).map((r) => {
          const mine = commissions.filter((c) => c.referrer_id === r.id);
          const sum = (s: string) => formatCop(mine.filter((c) => c.status === s).reduce((a, c) => a + c.amount_cop, 0));
          return <tr key={r.id}><td>{r.code}</td><td>{r.display_name}</td><td>{r.authorized ? "Sí" : "No"}</td><td>{r.commission_pct ?? "—"}</td><td>{sum("atribuible")}</td><td>{sum("recibida")}</td><td>{sum("anulada")}</td></tr>;
        })}</tbody>
      </table></div>
      <p className="small muted">Las comisiones atribuibles se generan solo con pagos verificados y se anulan si el pago se reembolsa o reversa. «Recibidas» refleja comisiones efectivamente pagadas.</p>
    </div>
  );
}

import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { formatBogotaDate } from "@/lib/domain/time";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const sb = await supabaseServer();
  let query = sb.from("profiles").select("id, full_name, email, created_at, subscriptions(status, current_period_end)").order("created_at", { ascending: false }).limit(50);
  if (q && q.trim().length >= 2) {
    const term = q.trim().replace(/[%,()]/g, "");
    query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }
  const { data } = await query;
  const rows = (data ?? []) as unknown as { id: string; full_name: string; email: string; created_at: string; subscriptions: { status: string; current_period_end: string | null } | null }[];
  return (
    <>
      <h1 style={{ fontSize: "1.6rem" }}>Clientes</h1>
      <form style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <label htmlFor="q" className="sr-only">Buscar</label>
        <input id="q" name="q" type="text" placeholder="Buscar por nombre o correo" defaultValue={q} />
        <button className="btn btn-primary">Buscar</button>
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Registro</th><th>Suscripción</th><th>Vence</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/admin/clientes/${r.id}`}>{r.full_name}</Link></td><td>{r.email}</td><td>{formatBogotaDate(new Date(r.created_at))}</td>
            <td>{r.subscriptions?.status ?? "—"}</td><td>{r.subscriptions?.current_period_end ? formatBogotaDate(new Date(r.subscriptions.current_period_end)) : "—"}</td>
          </tr>
        ))}</tbody>
      </table></div>
      {rows.length === 0 && <p className="muted">Sin resultados.</p>}
    </>
  );
}

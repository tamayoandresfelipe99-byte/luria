import { supabaseServer } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatBogotaDateTime } from "@/lib/domain/time";
import { revalidatePath } from "next/cache";

async function setStatus(fd: FormData) {
  "use server";
  await requireRole(["admin", "soporte"], "/admin/soporte");
  const sb = await supabaseServer();
  const status = String(fd.get("status"));
  if (!["abierta", "en_proceso", "esperando_cliente", "resuelta", "cerrada"].includes(status)) return;
  await sb.from("support_requests").update({ status }).eq("id", String(fd.get("id")));
  revalidatePath("/admin/soporte");
}

export default async function SoporteAdmin() {
  await requireRole(["admin", "soporte"], "/admin/soporte");
  const sb = await supabaseServer();
  const { data } = await sb.from("support_requests").select("id, category, description, status, created_at, profiles!support_requests_user_id_fkey(full_name, email)").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as { id: string; category: string; description: string; status: string; created_at: string; profiles: { full_name: string; email: string } }[];
  return (
    <div className="stack">
      <h1 style={{ fontSize: "1.6rem" }}>Soporte</h1>
      <div className="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Tema</th><th>Descripción</th><th>Estado</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td>{formatBogotaDateTime(new Date(r.created_at))}</td><td>{r.profiles.full_name}<br /><span className="small muted">{r.profiles.email}</span></td><td>{r.category}</td><td style={{ maxWidth: 380 }}>{r.description}</td>
            <td><form action={setStatus} style={{ display: "flex", gap: 6 }}><input type="hidden" name="id" value={r.id} /><select name="status" defaultValue={r.status} aria-label="Estado"><option value="abierta">Abierta</option><option value="en_proceso">En proceso</option><option value="esperando_cliente">Esperando cliente</option><option value="resuelta">Resuelta</option><option value="cerrada">Cerrada</option></select><button className="btn btn-ghost">Guardar</button></form></td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

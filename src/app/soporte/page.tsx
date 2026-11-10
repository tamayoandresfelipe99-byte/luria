import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "@/lib/content/faqs";
import { Notice } from "@/components/Notices";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { currentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { SupportForm } from "./SupportForm";
import { formatBogotaDateTime } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Soporte", description: "Contacta al soporte de LURIA por WhatsApp o con el formulario de incidencias." };

const STATUS: Record<string, string> = { abierta: "Abierta", en_proceso: "En proceso", esperando_cliente: "Esperando tu respuesta", resuelta: "Resuelta", cerrada: "Cerrada" };

export default async function SoportePage() {
  const user = await currentUser().catch(() => null);
  let requests: { id: string; category: string; status: string; created_at: string }[] = [];
  if (user) {
    const sb = await supabaseServer();
    const { data } = await sb.from("support_requests").select("id, category, status, created_at").order("created_at", { ascending: false }).limit(10);
    requests = (data ?? []) as typeof requests;
  }
  return (
    <section className="section">
      <div className="container stack">
        <h1>Soporte</h1>
        <Notice kind="warn" title="Por tu seguridad">Nunca te pediremos contraseñas institucionales ni información o evidencias de aprendices. No las envíes por ningún canal.</Notice>
        <div className="grid grid-2">
          <div className="card card-flat stack">
            <h2>WhatsApp</h2>
            <WhatsAppButton topic="comercial" label="Consultas comerciales" />
            <WhatsAppButton topic="instalacion" label="Ayuda de instalación" />
            <WhatsAppButton topic="compatibilidad" label="Dudas de compatibilidad" />
            <WhatsAppButton topic="pago" label="Problemas de pago" />
            <WhatsAppButton topic="renovacion" label="Renovaciones" />
            <WhatsAppButton topic="tecnica" label="Incidencias técnicas" />
          </div>
          <div className="card card-flat">
            <h2>Formulario de incidencia</h2>
            {user ? <SupportForm /> : <p><Link href="/ingreso?siguiente=/soporte">Inicia sesión</Link> para registrar una incidencia y consultar su estado.</p>}
          </div>
        </div>
        {requests.length > 0 && (
          <div className="card card-flat">
            <h2>Tus solicitudes</h2>
            <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Estado</th></tr></thead><tbody>
              {requests.map((r) => <tr key={r.id}><td>{formatBogotaDateTime(new Date(r.created_at))}</td><td>{r.category}</td><td>{STATUS[r.status] ?? r.status}</td></tr>)}
            </tbody></table></div>
          </div>
        )}
        <h2>Preguntas frecuentes</h2>
        {FAQS.map((f) => <details key={f.q}><summary>{f.q}</summary><p style={{ marginTop: 10 }}>{f.a}</p></details>)}
      </div>
    </section>
  );
}

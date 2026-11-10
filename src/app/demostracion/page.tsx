import type { Metadata } from "next";
import Link from "next/link";
import { FEATURES } from "@/lib/content/features";
import { Notice } from "@/components/Notices";

export const metadata: Metadata = { title: "Demostración", description: "Explicaciones guiadas de cómo funciona cada módulo de LURIA, sin datos reales de aprendices." };

export default function DemoPage() {
  return (
    <section className="section">
      <div className="container stack">
        <h1>Demostraciones</h1>
        <p className="lead">Conoce el funcionamiento antes de comprar. Las demostraciones no dan acceso a la extensión.</p>
        <Notice kind="warn" title="Demostraciones en preparación">
          Aún no hay videos o capturas autorizados del funcionamiento real. No publicamos ilustraciones como si fueran capturas,
          ni material con datos de aprendices. Mientras tanto, revisa la explicación guiada de cada función.
        </Notice>
        <div className="grid grid-2">
          {FEATURES.map((f) => (
            <article key={f.id} className="card card-flat">
              <h2 style={{ fontSize: "1.2rem" }}>{f.order}. {f.name}</h2>
              <ol>
                <li>Abres tu ficha en el entorno compatible con LURIA activa.</li>
                <li>{f.summary}</li>
                <li>{f.characteristics[1] ?? f.characteristics[0]}</li>
                <li>Revisas el resultado antes de cualquier acción sobre la plataforma.</li>
              </ol>
              <p className="small muted">Demostración autorizada: {f.demo ? <a href={f.demo.url}>ver</a> : "pendiente"}.</p>
            </article>
          ))}
        </div>
        <p><Link href="/compatibilidad" className="btn btn-accent">Verificar compatibilidad</Link></p>
      </div>
    </section>
  );
}

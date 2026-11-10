import type { Metadata } from "next";
import Link from "next/link";
import { FEATURES } from "@/lib/content/features";
import { FeatureCard } from "@/components/FeatureCard";
import { Notice } from "@/components/Notices";

export const metadata: Metadata = {
  title: "Funciones",
  description: "Vigía de calificación, paquete de evidencias, matriz de evidencias, gestor de fechas, juicios evaluativos y reenvíos: qué hace cada función de LURIA, requisitos y limitaciones.",
};

export default function FuncionesPage() {
  return (
    <section className="section">
      <div className="container stack">
        <h1>Funciones de LURIA</h1>
        <p className="lead">Seis módulos para apoyar la gestión académica y administrativa de tus fichas virtuales.</p>
        <Notice kind="info" title="Cómo leer esta página">
          Las descripciones provienen del fabricante. Cada función muestra su estado: <em>declarada</em>, <em>en validación</em>,{" "}
          <em>verificada</em>, <em>parcialmente disponible</em> o <em>no disponible</em>. Solo se marca como verificada con evidencia técnica.
        </Notice>
        <nav aria-label="Funciones" className="small">
          {FEATURES.map((f, i) => (
            <span key={f.id}>{i > 0 && " · "}<a href={`#${f.id}`}>{f.name}</a></span>
          ))}
        </nav>
        <div className="stack">{FEATURES.map((f) => <FeatureCard key={f.id} f={f} detailed />)}</div>
        <p><Link href="/compatibilidad" className="btn btn-accent">Verificar compatibilidad</Link></p>
      </div>
    </section>
  );
}

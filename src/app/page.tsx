import Link from "next/link";
import { FEATURES } from "@/lib/content/features";
import { FAQS } from "@/lib/content/faqs";
import { FeatureCard } from "@/components/FeatureCard";
import { DesktopNotice, IndependenceNotice } from "@/components/Notices";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Hero } from "@/components/Hero";
import { formatCop, PRODUCT } from "@/lib/domain/money";

export default function Home() {
  return (
    <>
      <Hero />

      <section className="section" aria-labelledby="beneficios">
        <div className="container">
          <h2 id="beneficios">Para qué sirve</h2>
          <div className="grid grid-3">
            {[
              ["Centraliza la información", "Consulta el estado de la ficha sin recorrer pantalla por pantalla."],
              ["Reduce tareas repetitivas", "Agrupa acciones que hoy haces una por una, como ajustes de fechas."],
              ["Apoya tus decisiones", "Consolida aprobados, pendientes y novedades para hacer seguimiento."],
            ].map(([t, d]) => (
              <div className="card card-flat" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft" aria-labelledby="funciones">
        <div className="container">
          <h2 id="funciones">Seis funciones</h2>
          <p className="muted">Descripciones declaradas por el fabricante. Cada función indica su estado de validación técnica.</p>
          <div className="grid grid-3">{FEATURES.map((f) => <FeatureCard key={f.id} f={f} />)}</div>
          <p style={{ marginTop: 20 }}><Link href="/funciones">Ver el detalle, requisitos y limitaciones de cada función →</Link></p>
        </div>
      </section>

      <section className="section" aria-labelledby="demo">
        <div className="container grid grid-2" style={{ alignItems: "center" }}>
          <div>
            <h2 id="demo">Mira cómo funciona antes de comprar</h2>
            <p className="muted">Las demostraciones autorizadas se publican en la página de demostración. No usan datos reales de aprendices.</p>
            <Link href="/demostracion" className="btn btn-ghost">Ir a demostraciones</Link>
          </div>
          <div>
            <h2>Compatibilidad</h2>
            <DesktopNotice />
            <Link href="/compatibilidad">Revisa los entornos verificados →</Link>
          </div>
        </div>
      </section>

      <section className="section section-soft" aria-labelledby="precio">
        <div className="container grid grid-2" style={{ alignItems: "center" }}>
          <div>
            <h2 id="precio">Precio</h2>
            <p className="price">{formatCop(PRODUCT.priceCop)} <small>COP / mes</small></p>
            <p className="muted">Suscripción individual. Sin pruebas ni días gratuitos. Puedes cancelar los cobros futuros cuando quieras.</p>
          </div>
          <div className="hero-actions"><Link href="/precio" className="btn btn-primary">Ver qué incluye</Link></div>
        </div>
      </section>

      <section className="section" aria-labelledby="faq">
        <div className="container">
          <h2 id="faq">Preguntas frecuentes</h2>
          {FAQS.map((f) => (
            <details key={f.q}><summary>{f.q}</summary><p style={{ marginTop: 10 }}>{f.a}</p></details>
          ))}
        </div>
      </section>

      <section className="section section-soft" aria-labelledby="contacto">
        <div className="container">
          <h2 id="contacto">Contacto</h2>
          <p className="muted">¿Tienes dudas sobre compatibilidad o compra? Escríbenos.</p>
          <WhatsAppButton topic="comercial" />
          <div style={{ marginTop: 24 }}><IndependenceNotice /></div>
        </div>
      </section>
    </>
  );
}

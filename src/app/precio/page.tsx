import type { Metadata } from "next";
import Link from "next/link";
import { formatCop, PRODUCT } from "@/lib/domain/money";
import { DesktopNotice, Notice, PendingDependency } from "@/components/Notices";
import { appConfig } from "@/lib/services/factory";

export const metadata: Metadata = { title: "Precio", description: "LURIA cuesta $40.000 COP al mes. Qué incluye, renovación, cancelación, soporte y requisitos." };

export default function PrecioPage() {
  const cfg = appConfig();
  return (
    <section className="section">
      <div className="container grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h1 style={{ fontSize: "1.6rem" }}>LURIA · suscripción mensual</h1>
          <p className="price">{formatCop(PRODUCT.priceCop)} <small>COP / mes</small></p>
          {!cfg.priceTaxTreatmentReviewed && <p className="small muted">Tratamiento tributario del precio pendiente de confirmación. El valor final se muestra antes de pagar.</p>}
          <h2 style={{ fontSize: "1.1rem" }}>Incluye</h2>
          <ul className="check-list">
            <li>Licencia individual de la extensión LURIA durante un mes.</li>
            <li>Las seis funciones, según su estado de disponibilidad.</li>
            <li>Actualizaciones publicadas durante la vigencia.</li>
            <li>Soporte por los canales oficiales.</li>
          </ul>
          <Link href="/compra" className="btn btn-primary btn-block">Suscribirme</Link>
          <p className="small muted" style={{ marginTop: 10 }}>Sin pruebas gratuitas, sin plan gratuito y sin descuentos.</p>
        </div>
        <div className="stack">
          <DesktopNotice />
          <div className="card card-flat">
            <h2>Condiciones</h2>
            <dl>
              <dt><strong>Duración</strong></dt><dd>Un mes. Vence al final del mismo número de día del mes siguiente, hora de Colombia.</dd>
              <dt><strong>Renovación</strong></dt><dd>{cfg.renewalMode === "automatic" ? "Automática, con tu autorización expresa." : cfg.renewalMode === "manual" ? "Manual: pagas cada mes desde tu cuenta." : "Modalidad (manual o automática) por definir."}</dd>
              <dt><strong>Cancelación</strong></dt><dd>Cancela los cobros futuros desde tu cuenta; conservas el acceso hasta el final del período pagado.</dd>
              <dt><strong>Entrega</strong></dt><dd>Activación de la licencia después de que la pasarela verifique el pago{cfg.activationSlaHours ? `, en un plazo máximo de ${cfg.activationSlaHours} horas` : " (plazo de activación por definir)"}.</dd>
              <dt><strong>Soporte</strong></dt><dd>WhatsApp y formulario de soporte.</dd>
              <dt><strong>Compatibilidad</strong></dt><dd><Link href="/compatibilidad">Verifícala antes de pagar</Link>.</dd>
            </dl>
          </div>
          {!cfg.sellerIdentity && <PendingDependency name="identidad del vendedor">Los datos del vendedor se publicarán antes de habilitar cobros reales.</PendingDependency>}
          <Notice kind="info">Consulta las <Link href="/legal/condiciones-compra">condiciones de compra</Link>, <Link href="/legal/renovaciones">renovaciones</Link> y <Link href="/legal/cancelaciones">cancelaciones</Link>.</Notice>
        </div>
      </div>
    </section>
  );
}

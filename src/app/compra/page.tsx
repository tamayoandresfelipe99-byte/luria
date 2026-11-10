import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadCustomerView } from "@/lib/services/customer";
import { appConfig } from "@/lib/services/factory";
import { realChargeBlockers, realChargesEnabled, simulationAllowed } from "@/lib/config";
import { purchaseGate } from "@/lib/domain/access";
import { formatCop, PRODUCT } from "@/lib/domain/money";
import { formatBogotaDate } from "@/lib/domain/time";
import { DesktopNotice, Notice } from "@/components/Notices";
import { CheckoutForm } from "./CheckoutForm";
import { EligibilityForm } from "../compatibilidad/EligibilityForm";

export const metadata: Metadata = { title: "Compra", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CompraPage() {
  await requireUser("/compra");
  const cfg = appConfig();
  const view = await loadCustomerView();
  const real = realChargesEnabled(cfg);
  const sim = simulationAllowed(cfg);
  const gate = purchaseGate({
    authenticated: true,
    acceptedTerms: true, // se confirma en el formulario y de nuevo en el servidor
    acknowledgedDesktopRequirement: true,
    eligibility: view.eligibilityVerified ? "verified" : "unverified",
    realChargesEnabled: real,
    simulationAllowed: sim,
    hasActiveFuturePeriod: view.hasFuturePeriod,
  });
  const continuing = view.subscription?.current_period_end && new Date(view.subscription.current_period_end) > new Date() && view.subscription.status !== "revoked";
  return (
    <section className="section">
      <div className="container grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h1 style={{ fontSize: "1.6rem" }}>Resumen del pedido</h1>
          <table>
            <tbody>
              <tr><th scope="row">Producto</th><td>{PRODUCT.name}</td></tr>
              <tr><th scope="row">Precio</th><td>{formatCop(PRODUCT.priceCop)} COP{!cfg.priceTaxTreatmentReviewed && " · tratamiento tributario pendiente"}</td></tr>
              <tr><th scope="row">Período</th><td>1 mes{continuing ? `, a partir del ${formatBogotaDate(new Date(view.subscription!.current_period_end!))} (renovación)` : ", desde la verificación del pago"}</td></tr>
              <tr><th scope="row">Renovación</th><td>{cfg.renewalMode === "automatic" ? "Automática (requiere tu autorización)" : "Manual: no haremos cobros automáticos"}</td></tr>
              <tr><th scope="row">Vendedor</th><td>{cfg.sellerIdentity || "Pendiente de publicación"}</td></tr>
              <tr><th scope="row">Medio de pago</th><td>{sim ? "Simulador (prototipo)" : cfg.paymentProvider === "wompi" ? "Wompi: tarjeta, PSE, Nequi y otros medios que habilite la pasarela" : "Por definir"}</td></tr>
            </tbody>
          </table>
          <p className="small muted">El precio lo calcula el servidor. Después de confirmar, te enviaremos a la pasarela de pagos. El acceso se activa cuando la pasarela verifica el pago y la licencia queda activa.</p>
          <p className="small"><Link href="/legal/condiciones-compra">Condiciones de compra</Link> · <Link href="/legal/renovaciones">Renovaciones</Link> · <Link href="/legal/cancelaciones">Cancelaciones</Link></p>
        </div>
        <div className="stack">
          <DesktopNotice />
          {sim && <Notice kind="warn" title="Prototipo">Estás en modo simulado. No se cobrará dinero y no se activará la extensión real.</Notice>}
          {!real && !sim && (
            <Notice kind="warn" title="Los pagos en línea aún no están habilitados">
              <ul style={{ margin: 0 }}>{realChargeBlockers(cfg).map((b) => <li key={b.key + b.message}>{b.message}</li>)}</ul>
            </Notice>
          )}
          {!view.eligibilityVerified ? (
            <div className="card card-flat">
              <h2 style={{ fontSize: "1.2rem" }}>Primero verifica la compatibilidad</h2>
              <EligibilityForm />
              <p className="small muted">Después de verificar, recarga esta página.</p>
            </div>
          ) : gate.allowed ? (
            <CheckoutForm simulated={gate.simulated} />
          ) : (
            <Notice kind="err" title="No es posible comprar en este momento"><ul style={{ margin: 0 }}>{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul></Notice>
          )}
        </div>
      </div>
    </section>
  );
}

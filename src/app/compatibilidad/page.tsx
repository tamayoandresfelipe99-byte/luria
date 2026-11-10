import type { Metadata } from "next";
import { DesktopNotice, Notice, PendingDependency } from "@/components/Notices";
import { EligibilityForm } from "./EligibilityForm";
import { appConfig } from "@/lib/services/factory";

export const metadata: Metadata = { title: "Compatibilidad", description: "Requisitos para usar LURIA: Google Chrome en computador y entorno ZAJUNA compatible verificado." };

export default function CompatibilidadPage() {
  const cfg = appConfig();
  return (
    <section className="section">
      <div className="container stack">
        <h1>Compatibilidad</h1>
        <p className="lead">Antes de pagar, confirma que tu entorno es compatible. Si no lo es, no te dejaremos comprar.</p>
        <DesktopNotice />
        <div className="grid grid-2">
          <div className="card card-flat">
            <h2>Requisitos</h2>
            <ul>
              <li><strong>Navegador:</strong> Google Chrome actualizado.</li>
              <li><strong>Dispositivo:</strong> computador de escritorio o portátil.</li>
              <li><strong>Entorno:</strong> ZAJUNA, en una configuración verificada.</li>
              <li><strong>Formación:</strong> instructores que imparten formación exclusivamente virtual.</li>
              <li><strong>Instalación:</strong> permisos para instalar extensiones en Chrome.</li>
            </ul>
          </div>
          <div className="card card-flat">
            <h2>Entornos verificados</h2>
            {cfg.supportedEnvironmentsVerified ? (
              <p>Consulta la lista de versiones comprobadas en la sección de instalación.</p>
            ) : (
              <PendingDependency name="compatibilidad exacta">
                La lista de entornos y versiones verificados aún no está confirmada técnicamente. Mientras tanto, la compra en línea permanece bloqueada.
              </PendingDependency>
            )}
            <h3>Limitaciones conocidas</h3>
            <ul>
              <li>No funciona en navegadores móviles ni en tabletas.</li>
              <li>Cambios en la plataforma pueden afectar temporalmente algunas funciones.</li>
              <li>Equipos administrados pueden bloquear la instalación de extensiones.</li>
            </ul>
          </div>
        </div>
        <div className="card">
          <h2>Verifica tu elegibilidad</h2>
          <EligibilityForm />
        </div>
        <Notice kind="info">La verificación no guarda información académica. Solo registramos las respuestas de este formulario.</Notice>
      </div>
    </section>
  );
}

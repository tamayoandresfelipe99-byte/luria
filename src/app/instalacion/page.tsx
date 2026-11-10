import type { Metadata } from "next";
import { DesktopNotice, PendingDependency } from "@/components/Notices";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { appConfig } from "@/lib/services/factory";

export const metadata: Metadata = { title: "Instalación", description: "Requisitos y pasos para instalar LURIA en Google Chrome." };

export default function InstalacionPage() {
  const cfg = appConfig();
  return (
    <section className="section">
      <div className="container stack" style={{ maxWidth: 820 }}>
        <h1>Instalación</h1>
        <DesktopNotice />
        <h2>Requisitos</h2>
        <ul>
          <li>Google Chrome actualizado en computador.</li>
          <li>Permiso para instalar extensiones en ese equipo.</li>
          <li>Cuenta en esta web con suscripción pagada y licencia activa.</li>
        </ul>
        <h2>Pasos</h2>
        {cfg.extensionInstallUrl ? (
          <ol>
            <li>Abre Chrome en tu computador e inicia sesión en tu cuenta de LURIA.</li>
            <li><a href={cfg.extensionInstallUrl} rel="noopener">Abre el enlace oficial de instalación</a> y pulsa «Agregar a Chrome».</li>
            <li>Fija la extensión en la barra de Chrome.</li>
            <li>Sigue las instrucciones de activación de la licencia.</li>
          </ol>
        ) : (
          <PendingDependency name="enlace real de instalación">
            El procedimiento detallado y el enlace oficial se publicarán cuando el equipo de la extensión los confirme. No usamos enlaces provisionales.
          </PendingDependency>
        )}
        <h2>Solución de problemas</h2>
        <details><summary>Chrome no me deja instalar extensiones</summary><p>Tu equipo puede estar administrado por una organización. Usa un equipo propio o consulta a tu administrador.</p></details>
        <details><summary>Pagué pero no tengo acceso</summary><p>Revisa el estado en «Mi cuenta». Si dice «activación pendiente», ya creamos una tarea para activarla. Si pasa el plazo, contáctanos.</p></details>
        <details><summary>La extensión no aparece en la plataforma</summary><p>Verifica que estás en un entorno compatible y que la licencia está activa.</p></details>
        <WhatsAppButton topic="instalacion" label="Ayuda con la instalación" />
      </div>
    </section>
  );
}

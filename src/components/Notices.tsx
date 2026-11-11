import type { ReactNode } from "react";
import { DESKTOP_REQUIREMENT, INDEPENDENCE_NOTICE } from "@/lib/content/site";

export function Notice({ kind = "info", title, children }: { kind?: "info" | "warn" | "err" | "ok"; title?: string; children: ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "err" ? "alert" : "status"}>
      {title && <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>}
      {children}
    </div>
  );
}

export function IndependenceNotice() {
  return <Notice kind="info" title="Aviso de independencia">{INDEPENDENCE_NOTICE}</Notice>;
}

export function DesktopNotice() {
  return <Notice kind="warn" title="Requisito de instalación">{DESKTOP_REQUIREMENT}</Notice>;
}

export function SimulationBanner() {
  return (
    <aside className="sim-banner" aria-label="Modo prototipo">
      MODO PROTOTIPO · Pagos y licencias simulados. Ninguna transacción es real y no se concede acceso a la extensión.
    </aside>
  );
}

export function PendingDependency({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Notice kind="warn" title={`Pendiente: ${name}`}>
      {children}
    </Notice>
  );
}

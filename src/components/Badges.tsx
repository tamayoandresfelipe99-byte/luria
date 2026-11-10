import { FEATURE_STATUS_LABEL, type FeatureStatus } from "@/lib/content/features";
import type { CustomerState } from "@/lib/domain/access";

export function FeatureStatusBadge({ status }: { status: FeatureStatus }) {
  const cls = status === "verificada" ? "badge-ok" : status === "no_disponible" ? "badge-err" : status === "parcial" ? "badge-warn" : "badge-info";
  return <span className={`badge ${cls}`}>{FEATURE_STATUS_LABEL[status]}</span>;
}

export const CUSTOMER_STATE_UI: Record<CustomerState, { label: string; cls: string; help: string }> = {
  sin_suscripcion: { label: "Sin suscripción", cls: "badge-info", help: "Aún no tienes una suscripción." },
  pago_pendiente: { label: "Pago pendiente", cls: "badge-warn", help: "Tu pago está en proceso. Te avisaremos cuando la pasarela lo confirme." },
  pago_rechazado: { label: "Pago no aprobado", cls: "badge-err", help: "La pasarela no aprobó el pago. Puedes intentarlo de nuevo." },
  activacion_pendiente: { label: "Pago recibido, activación pendiente", cls: "badge-warn", help: "Tu pago está verificado. Estamos activando tu licencia." },
  activacion_fallida: { label: "Activación con incidencia", cls: "badge-err", help: "Tu pago está verificado, pero la activación tuvo un problema. Ya se creó una tarea para resolverlo." },
  activa: { label: "Activa", cls: "badge-ok", help: "Tu licencia está activa." },
  por_vencer: { label: "Próxima a vencer", cls: "badge-warn", help: "Tu período termina pronto. Renueva para no perder el acceso." },
  cancelada_al_final: { label: "Activa · no se renovará", cls: "badge-info", help: "Cancelaste los cobros futuros. Conservas el acceso hasta el fin del período pagado." },
  vencida: { label: "Vencida", cls: "badge-err", help: "Tu período terminó. Renueva para recuperar el acceso." },
  revocada: { label: "Revocada", cls: "badge-err", help: "El acceso fue revocado por un reembolso o reversión. Contacta a soporte si tienes dudas." },
};

export function CustomerStateBadge({ state }: { state: CustomerState }) {
  const ui = CUSTOMER_STATE_UI[state];
  return <span className={`badge ${ui.cls}`}>{ui.label}</span>;
}

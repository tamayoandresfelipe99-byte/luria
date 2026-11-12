import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadCustomerView } from "@/lib/services/customer";
import { CUSTOMER_STATE_UI, CustomerStateBadge } from "@/components/Badges";
import { Notice } from "@/components/Notices";
import { formatBogotaDate, formatBogotaDateTime } from "@/lib/domain/time";
import { formatCop } from "@/lib/domain/money";
import { PAYMENT_LABELS } from "@/lib/domain/states";
import { logoutAction } from "../auth-actions";
import { AccountActions } from "./AccountActions";
import { ProfileForm } from "./ProfileForm";
import { appConfig } from "@/lib/services/factory";
import { loadMyAccess, loadMyNotifications } from "@/lib/services/access";
import { clientAccessMessage } from "@/lib/domain/access-delivery";
import { AccessStatusBadge, PaymentStateBadge } from "@/components/AccessBadges";
import { markNotificationsReadAction } from "./actions";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };
export const dynamic = "force-dynamic";

const LICENSE_LABEL: Record<string, string> = { requested: "Solicitada", active: "Activa", expired: "Vencida", revoked: "Revocada", failed: "Con error" };

export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const user = await requireUser("/cuenta");
  const { aviso } = await searchParams;
  const [v, access, notes] = await Promise.all([loadCustomerView(), loadMyAccess(), loadMyNotifications(user.id)]);
  const msg = access ? clientAccessMessage(access.payment_state, access.access_status, !!access.link_url) : null;
  const unread = notes.filter((n) => !n.read_at).length;
  const cfg = appConfig();
  const ui = CUSTOMER_STATE_UI[v.state];
  const s = v.subscription;
  const canRenew = ["sin_suscripcion", "pago_rechazado", "por_vencer", "vencida", "activa", "cancelada_al_final", "revocada"].includes(v.state) && !v.hasFuturePeriod;
  return (
    <section className="section">
      <div className="container stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ margin: 0 }}>Hola, {v.profile?.full_name ?? "cliente"}</h1>
          <form action={logoutAction}><button className="btn btn-ghost">Cerrar sesión</button></form>
        </div>
        {aviso === "clave-actualizada" && <Notice kind="ok">Tu contraseña se actualizó.</Notice>}
        {aviso === "sin-permiso" && <Notice kind="warn">No tienes permisos para esa sección.</Notice>}
        {aviso === "sin-acceso" && <Notice kind="warn">Tu acceso a LURIA no está disponible en este momento. Revisa el estado de tu suscripción.</Notice>}

        {access && msg && (
          <div className="card access-card stack" aria-labelledby="acceso-titulo">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h2 id="acceso-titulo" style={{ fontSize: "1.25rem", margin: 0 }}>Tu acceso a LURIA</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <PaymentStateBadge state={access.payment_state} />
                <AccessStatusBadge status={access.access_status} />
              </div>
            </div>
            <Notice kind={msg.tone === "err" ? "err" : msg.tone === "warn" ? "warn" : msg.tone === "ok" ? "ok" : "info"}>{msg.text}</Notice>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {msg.showAccessButton && (
                <a className="btn btn-primary btn-lg" href="/acceso" target="_blank" rel="noopener noreferrer">Acceder a LURIA <span aria-hidden="true">↗</span></a>
              )}
              {msg.cta && <Link className={msg.showAccessButton ? "btn btn-ghost" : "btn btn-primary"} href={msg.cta.href}>{msg.cta.label}</Link>}
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div className="card stack" aria-labelledby="notif-titulo">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h2 id="notif-titulo" style={{ fontSize: "1.25rem", margin: 0 }}>Notificaciones{unread > 0 ? ` (${unread} nuevas)` : ""}</h2>
              {unread > 0 && <form action={markNotificationsReadAction}><button className="btn btn-ghost btn-sm">Marcar como leídas</button></form>}
            </div>
            <ul className="notif-list">
              {notes.map((n) => (
                <li key={n.id} className={n.read_at ? undefined : "notif-unread"}>
                  <strong>{n.title}</strong>
                  <div className="small muted">{formatBogotaDateTime(new Date(n.created_at))}</div>
                  <div>{n.body}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-2">
          <div className="card stack">
            <h2 style={{ fontSize: "1.25rem" }}>Suscripción</h2>
            <p><CustomerStateBadge state={v.state} /></p>
            <p className="muted">{ui.help}</p>
            {s && (
              <dl>
                <dt><strong>Inicio</strong></dt><dd>{s.current_period_start ? formatBogotaDate(new Date(s.current_period_start)) : "—"}</dd>
                <dt><strong>Vencimiento</strong></dt><dd>{s.current_period_end ? formatBogotaDateTime(new Date(s.current_period_end)) : "—"}</dd>
                <dt><strong>Renovación</strong></dt><dd>{s.cancel_at_period_end ? "No se renovará" : s.renewal_mode === "automatic" ? "Automática" : "Manual"}</dd>
                <dt><strong>Licencia</strong></dt><dd>{v.license ? LICENSE_LABEL[v.license.status] : "Sin licencia"}</dd>
              </dl>
            )}
            {v.state === "activacion_pendiente" && <Notice kind="warn">Tu pago está verificado. {cfg.activationSlaHours ? `La activación se completa en un máximo de ${cfg.activationSlaHours} horas.` : "Te avisaremos cuando la licencia esté activa."}</Notice>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {canRenew && <Link className="btn btn-primary" href="/compra">{s ? "Renovar un mes" : "Suscribirme"}</Link>}
              {v.state === "activa" || v.state === "por_vencer" || v.state === "cancelada_al_final" ? <Link className="btn btn-ghost" href="/instalacion">Instalación</Link> : null}
            </div>
            {s && s.status !== "revoked" && s.status !== "expired" && <AccountActions cancelAtPeriodEnd={s.cancel_at_period_end} periodEnd={s.current_period_end} />}
          </div>

          <div className="card stack">
            <h2 style={{ fontSize: "1.25rem" }}>Tus datos</h2>
            <p className="small muted">Correo: {v.profile?.email}</p>
            <ProfileForm name={v.profile?.full_name ?? ""} phone={v.profile?.phone ?? ""} marketing={v.marketingGranted} />
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: "1.25rem" }}>Historial de pagos</h2>
          {v.payments.length === 0 ? (
            <p className="muted">Aún no tienes pagos registrados.</p>
          ) : (
            <div className="table-wrap"><table>
              <thead><tr><th>Fecha</th><th>Pedido</th><th>Valor</th><th>Medio</th><th>Estado</th></tr></thead>
              <tbody>{v.payments.map((p) => (
                <tr key={p.id}><td>{formatBogotaDateTime(new Date(p.created_at))}</td><td><code>{p.reference}</code></td><td>{formatCop(p.amount_cents / 100)}</td><td>{p.method ?? p.provider}</td><td>{PAYMENT_LABELS[p.status]}</td></tr>
              ))}</tbody>
            </table></div>
          )}
          <p className="small muted" style={{ marginTop: 10 }}>Estos registros son comprobantes de transacción, no facturas electrónicas.</p>
        </div>
        <p><Link href="/soporte">¿Necesitas ayuda? Ir a soporte →</Link></p>
      </div>
    </section>
  );
}

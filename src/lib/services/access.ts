import "server-only";
import { supabaseServer } from "../supabase/server";
import type { AccessStatus, PaymentState } from "../domain/access-delivery";

export interface AccessOverviewRow {
  user_id: string;
  full_name: string;
  email: string;
  registered_at: string;
  payment_state: PaymentState;
  period_end: string | null;
  access_status: AccessStatus;
  link_url: string | null;
  enabled_at: string | null;
  enabled_by_name: string | null;
  status_changed_at: string | null;
  status_reason: string | null;
  is_staff: boolean;
}

/** Tabla del personal: datos reales de Supabase. La función SQL verifica el rol y oculta enlaces al rol comercial. */
export async function loadAccessOverview(): Promise<AccessOverviewRow[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("fn_admin_access_overview");
  if (error) throw new Error("No se pudo cargar la tabla de accesos");
  return (data ?? []) as AccessOverviewRow[];
}

export interface MyAccess {
  payment_state: PaymentState;
  period_end: string | null;
  access_status: AccessStatus;
  link_url: string | null;
}

/** Estado propio del cliente. El enlace solo llega si el acceso está habilitado y la suscripción vigente. */
export async function loadMyAccess(): Promise<MyAccess | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("fn_my_access");
  if (error) return null;
  return ((data ?? []) as MyAccess[])[0] ?? null;
}

export interface NotificationRow { id: string; kind: string; title: string; body: string; created_at: string; read_at: string | null }

export async function loadMyNotifications(userId: string): Promise<NotificationRow[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("notifications").select("id, kind, title, body, created_at, read_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  return (data ?? []) as NotificationRow[];
}

import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type StaffRole = "comercial" | "soporte" | "admin";

export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser(); // valida el JWT contra Supabase Auth
  return data.user ?? null;
}

export async function requireUser(next: string) {
  const user = await currentUser();
  if (!user) redirect(`/ingreso?siguiente=${encodeURIComponent(next)}`);
  return user;
}

export async function staffRoles(userId?: string): Promise<StaffRole[]> {
  const sb = await supabaseServer();
  const uid = userId ?? (await sb.auth.getUser()).data.user?.id;
  if (!uid) return [];
  // Filtro explícito por usuario: un admin puede leer todos los roles por RLS y no debe heredarlos.
  const { data } = await sb.from("staff_roles").select("role").eq("user_id", uid);
  return ((data ?? []) as { role: StaffRole }[]).map((r) => r.role);
}

/** Exige al menos uno de los roles. Redirige si no hay sesión; 404 lógico si no tiene permiso. */
export async function requireRole(allowed: StaffRole[], next = "/admin") {
  const user = await requireUser(next);
  const roles = await staffRoles(user.id);
  if (!roles.some((r) => allowed.includes(r))) redirect("/cuenta?aviso=sin-permiso");
  return { user, roles };
}

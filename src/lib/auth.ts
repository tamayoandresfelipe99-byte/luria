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

export async function staffRoles(): Promise<StaffRole[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("staff_roles").select("role");
  return ((data ?? []) as { role: StaffRole }[]).map((r) => r.role);
}

/** Exige al menos uno de los roles. Redirige si no hay sesión; 404 lógico si no tiene permiso. */
export async function requireRole(allowed: StaffRole[], next = "/admin") {
  const user = await requireUser(next);
  const roles = await staffRoles();
  if (!roles.some((r) => allowed.includes(r))) redirect("/cuenta?aviso=sin-permiso");
  return { user, roles };
}

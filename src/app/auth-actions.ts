"use server";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loginSchema, recoverSchema, registerSchema } from "@/lib/validation";
import { rateLimitShared } from "@/lib/security/request";
import { appConfig } from "@/lib/services/factory";
import { loginErrorMessage, recoverAccountMessage, registerDoneMessage } from "@/lib/services/auth-messages";
import { NOTICE_VERSIONS } from "@/lib/content/site";
import { passwordProblem } from "@/lib/security/password";
import { safeInternalPath } from "@/lib/security/redirect";

export interface FormState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
}


export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimitShared(`reg:${await ip()}`, 5, 15 * 60_000))) return { message: "Demasiados intentos. Espera unos minutos." };
  const raw = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")));
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, message: "Revisa los campos marcados." };
  const v = parsed.data;
  const cfg = appConfig();
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({
    email: v.email,
    password: v.password,
    options: { data: { full_name: v.name, phone: v.phone || null }, emailRedirectTo: `${cfg.appUrl}/auth/confirmar` },
  });
  // Mensaje neutral: no revela si el correo ya existía.
  if (error && !/registered|exists/i.test(error.message)) return { message: "No pudimos crear la cuenta. Inténtalo de nuevo." };
  const userId = data?.user?.identities?.length ? data.user.id : null;
  if (userId) {
    const admin = supabaseAdmin();
    await admin.from("consents").insert([
      { user_id: userId, purpose: "terms", granted: true, notice_version: NOTICE_VERSIONS.terms },
      { user_id: userId, purpose: "privacy", granted: true, notice_version: NOTICE_VERSIONS.privacy },
      // A02: el consentimiento comercial es opcional y no bloquea nada.
      { user_id: userId, purpose: "marketing", granted: v.marketing === "on", notice_version: NOTICE_VERSIONS.marketing },
    ]);
    const src = (await cookies()).get("luria_src")?.value;
    if (src) {
      const [channel, code] = src.split(":");
      let referrer_id: string | null = null;
      if (code) {
        const { data: ref } = await admin.from("referrers").select("id").eq("code", code).eq("authorized", true).maybeSingle();
        referrer_id = (ref as { id: string } | null)?.id ?? null;
      }
      await admin.from("attribution").insert({ user_id: userId, channel: channel || "otro", referrer_id });
    }
  }
  return { ok: true, message: registerDoneMessage() };
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").toLowerCase();
  if (!(await rateLimitShared(`login:${await ip()}`, 10, 15 * 60_000)) || !(await rateLimitShared(`login:${email}`, 5, 15 * 60_000)))
    return { message: "Demasiados intentos. Espera unos minutos o recupera tu acceso." };
  const parsed = loginSchema.safeParse({ email, password: fd.get("password") });
  if (!parsed.success) return { message: loginErrorMessage() };
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) return { message: /confirm/i.test(error.message) ? "Confirma tu correo antes de ingresar." : loginErrorMessage() };
  redirect(safeInternalPath(fd.get("siguiente")));
}

export async function recoverAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimitShared(`rec:${await ip()}`, 5, 15 * 60_000))) return { ok: true, message: recoverAccountMessage(false) };
  const parsed = recoverSchema.safeParse({ email: fd.get("email") });
  if (parsed.success) {
    const sb = await supabaseServer();
    await sb.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${appConfig().appUrl}/auth/confirmar?siguiente=/restablecer` });
  }
  // A16: misma respuesta exista o no la cuenta.
  return { ok: true, message: recoverAccountMessage(true) };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const pwd = String(fd.get("password") ?? "");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { message: "El enlace venció o no es válido. Solicita uno nuevo." };
  if (!(await rateLimitShared(`reset:${auth.user.id}`, 5, 15 * 60_000))) return { message: "Demasiados intentos. Espera unos minutos." };
  const { data: prof } = await sb.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
  const problem = passwordProblem(pwd, { name: (prof as { full_name: string } | null)?.full_name ?? (auth.user.user_metadata?.full_name as string | undefined) });
  if (problem) return { message: problem };
  if (pwd !== fd.get("confirm")) return { message: "Las contraseñas no coinciden." };
  const { error } = await sb.auth.updateUser({ password: pwd });
  if (error) return { message: "No pudimos cambiar la contraseña. Si el enlace venció, solicita uno nuevo." };
  // Cierra las demás sesiones abiertas: si alguien más tenía acceso, lo pierde al cambiar la contraseña.
  await sb.auth.signOut({ scope: "others" });
  redirect("/cuenta?aviso=clave-actualizada");
}

export async function logoutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/");
}

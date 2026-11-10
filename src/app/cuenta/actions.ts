"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { NOTICE_VERSIONS } from "@/lib/content/site";

export interface ProfileState { ok?: boolean; message?: string }

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^(\+?57)?\s?3\d{9}$/).optional().or(z.literal("")),
  marketing: z.literal("on").optional(),
});

export async function updateProfileAction(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const parsed = schema.safeParse({ name: fd.get("name"), phone: fd.get("phone") ?? "", marketing: fd.get("marketing") ?? undefined });
  if (!parsed.success) return { message: "Revisa el nombre y el celular." };
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { message: "Tu sesión venció." };
  const { error } = await sb.from("profiles").update({ full_name: parsed.data.name, phone: parsed.data.phone || null }).eq("id", auth.user.id);
  if (error) return { message: "No pudimos guardar los cambios." };
  // Consentimiento comercial: se agrega un registro nuevo (historial); manda el más reciente (A18).
  const { data: last } = await sb.from("consents").select("granted").eq("purpose", "marketing").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const want = parsed.data.marketing === "on";
  if (!last || (last as { granted: boolean }).granted !== want) {
    await sb.from("consents").insert({ user_id: auth.user.id, purpose: "marketing", granted: want, notice_version: NOTICE_VERSIONS.marketing });
  }
  revalidatePath("/cuenta");
  return { ok: true, message: "Cambios guardados." };
}

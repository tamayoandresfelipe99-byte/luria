import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Confirmación de correo y enlaces de recuperación (plantillas de Supabase con token_hash).
 * Los enlaces vencen según la configuración de Supabase Auth (recomendado: 1 hora).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as "signup" | "recovery" | "email" | null;
  const next = url.searchParams.get("siguiente") ?? (type === "recovery" ? "/restablecer" : "/cuenta");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/cuenta";
  if (token_hash && type) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(dest, url.origin));
  }
  // Respaldo: plantillas por defecto de Supabase (flujo PKCE, `?code=`). Solo funciona en el
  // mismo navegador donde se pidió el enlace; por eso las plantillas recomendadas usan token_hash.
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(dest, url.origin));
  }
  return NextResponse.redirect(new URL("/ingreso?aviso=enlace-invalido", url.origin));
}

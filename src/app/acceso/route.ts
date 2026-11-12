import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Botón «Acceder a LURIA». El enlace nunca se escribe en la página: en cada clic el servidor vuelve a comprobar
 * sesión, acceso habilitado y suscripción vigente (`fn_my_access`) y solo entonces redirige.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/ingreso?siguiente=%2Fcuenta", origin), 303);
  const { data } = await sb.rpc("fn_my_access");
  const row = ((data ?? []) as { link_url: string | null }[])[0];
  const link = row?.link_url;
  if (!link || !link.startsWith("https://")) return NextResponse.redirect(new URL("/cuenta?aviso=sin-acceso", origin), 303);
  const res = NextResponse.redirect(link, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

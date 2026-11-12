import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE_OPTIONS } from "./lib/supabase/cookie-options";

/**
 * Proxy (antes "middleware" en Next.js ≤15):
 *  1) Refresca la sesión de Supabase en cada solicitud.
 *  2) Exige sesión en áreas privadas (el rol se valida además en el servidor y por RLS).
 *  3) Guarda la fuente de adquisición (?utm_source / ?ref) en una cookie de primera parte, sin datos personales.
 */
const PRIVATE = ["/cuenta", "/compra", "/pago", "/admin"];
const CHANNELS = new Set(["whatsapp", "referido", "organico", "redes", "directo", "otro"]);

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authed = false;
  if (url && key) {
    const sb = createServerClient(url, key, {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          for (const { name, value } of list) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of list) res.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await sb.auth.getUser();
    authed = !!data.user;
  }

  const path = req.nextUrl.pathname;
  if (PRIVATE.some((p) => path === p || path.startsWith(`${p}/`)) && !authed) {
    const to = req.nextUrl.clone();
    to.pathname = "/ingreso";
    to.search = `?siguiente=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }

  const src = req.nextUrl.searchParams.get("utm_source")?.toLowerCase();
  const ref = req.nextUrl.searchParams.get("ref")?.toUpperCase();
  if ((src || ref) && !req.cookies.get("luria_src")) {
    const channel = ref ? "referido" : CHANNELS.has(src!) ? src! : "otro";
    const code = ref && /^[A-Z0-9-]{3,30}$/.test(ref) ? ref : "";
    res.cookies.set("luria_src", `${channel}:${code}`, { maxAge: 30 * 86400, sameSite: "lax", secure: true, httpOnly: true, path: "/" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/pagos/webhook|api/cron).*)"],
};

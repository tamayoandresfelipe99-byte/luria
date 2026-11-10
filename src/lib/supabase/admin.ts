import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE ROLE: ignora RLS. Uso exclusivo en el servidor para
 * webhooks, funciones transaccionales y tareas programadas.
 * Nunca importar desde componentes cliente (lo verifica la prueba A19).
 */
let cached: SupabaseClient | null = null;
export function supabaseAdmin() {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase no está configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cached;
}

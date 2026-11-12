import { supabaseServer } from "@/lib/supabase/server";
import { hasExtensionAccess } from "@/lib/domain/access";
import { json } from "@/lib/security/request";

/** Estado verificado de un pedido del usuario (RLS impide consultar pedidos ajenos, A10). */
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("referencia") ?? "";
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ view: "no_encontrado", message: "Inicia sesión para ver el estado." }, 401);
  if (!/^LUR-\d{8}-[A-Z0-9]{10}$/.test(ref)) return json({ view: "no_encontrado", message: "No encontramos ese pedido en tu cuenta." });
  // Filtro explícito por propietario además de RLS: el personal también consulta aquí solo sus propios pedidos.
  const { data: order } = await sb.from("orders").select("id, status").eq("reference", ref).eq("user_id", auth.user.id).maybeSingle();
  if (!order) return json({ view: "no_encontrado", message: "No encontramos ese pedido en tu cuenta." });
  const { data: pay } = await sb.from("payments").select("status, discrepancy").eq("order_id", (order as { id: string }).id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const p = pay as { status: string; discrepancy: boolean } | null;
  if (!p || p.status === "pending") return json({ view: "pendiente", message: "Aún no recibimos la confirmación de la pasarela. Esta página se actualiza sola." });
  if (p.discrepancy) return json({ view: "en_revision", message: "El pago requiere una revisión manual. Te contactaremos; no es necesario pagar de nuevo." });
  if (["declined", "voided", "error"].includes(p.status)) return json({ view: "rechazado", message: "La pasarela no aprobó el pago. No se realizó ningún cobro por este pedido." });
  if (["refunded", "reversed"].includes(p.status)) return json({ view: "en_revision", message: "Este pago fue reembolsado o reversado y la licencia asociada fue revocada." });
  const { data: lic } = await sb.from("licenses").select("status, valid_until").eq("user_id", auth.user.id).maybeSingle();
  const l = lic as { status: "active" | "requested"; valid_until: string | null } | null;
  const active = hasExtensionAccess(l ? { status: l.status, validUntil: l.valid_until ? new Date(l.valid_until) : null } : null, new Date());
  return active
    ? json({ view: "aprobado_activo", message: "Tu pago fue verificado y tu licencia está activa." })
    : json({ view: "pago_recibido_activacion_pendiente", message: "Tu pago fue verificado. La licencia está en proceso de activación; te avisaremos cuando quede activa." });
}

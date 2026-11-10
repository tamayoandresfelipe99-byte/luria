import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { eligibilitySchema } from "@/lib/validation";
import { classifyEligibility } from "@/lib/domain/eligibility";
import { appConfig } from "@/lib/services/factory";
import { clientIp, json, rateLimit, sameOrigin } from "@/lib/security/request";

export async function POST(req: Request) {
  const cfg = appConfig();
  if (!sameOrigin(req, cfg.appUrl)) return json({ error: "Origen no permitido" }, 403);
  if (!rateLimit(`elig:${clientIp(req)}`, 20, 10 * 60_000)) return json({ error: "Demasiados intentos" }, 429);
  const parsed = eligibilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Datos inválidos" }, 400);
  const out = classifyEligibility(parsed.data, cfg.supportedEnvironmentsVerified);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  await supabaseAdmin().from("eligibility_checks").insert({
    user_id: auth.user?.id ?? null,
    platform: parsed.data.platform,
    domain: parsed.data.domain || null,
    browser: parsed.data.browser,
    device: parsed.data.device,
    virtual_only: parsed.data.virtualOnly === "si",
    result: out.result,
  });
  return json(out);
}

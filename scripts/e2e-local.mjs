// Prueba de punta a punta contra Supabase local (`npx supabase start`) y `next dev`
// con PAYMENT_PROVIDER=mock y LICENSE_ADAPTER=simulated.
// Uso: node scripts/e2e-local.mjs   (requiere Playwright y la app en http://localhost:3000)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3000";
const MAIL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const DB = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const stamp = Date.now();
const email = `cliente.${stamp}@ejemplo.test`;
const otherEmail = `otro.${stamp}@ejemplo.test`;
const password = "ClaveSegura-2026!";
const newPassword = "OtraClave-2026!!";

let failures = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push(`${ok ? "✔" : "✘"} ${name}${detail ? `  [${detail}]` : ""}`);
  if (!ok) failures++;
}
const sql = (q) => execFileSync("psql", [DB, "-At", "-c", q], { encoding: "utf8" }).trim();

async function latestMailLink(to, mustInclude) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const j = await r.json();
    for (const m of j.messages ?? []) {
      const full = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json();
      const links = [...(full.HTML ?? full.Text ?? "").matchAll(/href="([^"]+)"/g)].map((x) => x[1].replace(/&amp;/g, "&"));
      const link = links.find((l) => l.includes(mustInclude));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const settled = (p) => p.waitForFunction(() => !document.querySelector("main")?.innerText.includes("Cargando…"), null, { timeout: 20000 }).catch(() => {});

async function register(page, mail) {
  await page.goto(`${APP}/registro`);
  await page.fill("#name", "Instructora de Prueba");
  await page.fill("#email", mail);
  await page.fill("#password", password);
  await page.check('input[name="acceptTerms"]');
  await page.check('input[name="acceptPrivacy"]');
  await page.click('button:has-text("Crear cuenta")');
  await page.waitForLoadState("networkidle");
}

async function login(page, mail, pwd = password) {
  await page.goto(`${APP}/ingreso`);
  await page.fill("#email", mail);
  await page.fill("#password", pwd);
  await page.click('button:has-text("Ingresar")');
  await page.waitForLoadState("networkidle");
}

// El límite de solicitudes es compartido (tabla rate_limits): se reinicia para que corridas
// seguidas desde la misma IP no choquen con el límite de 5 registros cada 15 minutos.
sql("delete from public.rate_limits");

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(e.message));

try {
  // 1. Registro y confirmación por correo
  await register(page, email);
  const okNotice = await page.locator('.notice-ok[role="status"]').count();
  const formMsg = ((await page.textContent("main")) ?? "").includes("Demasiados intentos") ? "límite de intentos de la app (5 registros / 15 min por IP): reinicia `next dev`" : "";
  check("Registro exitoso muestra aviso de confirmación", okNotice === 1, formMsg);
  check("Perfil creado por trigger", sql(`select count(*) from public.profiles p join auth.users u on u.id=p.id where u.email='${email}'`) === "1");
  check("A02 Consentimientos guardados (marketing rechazado)", sql(`select count(*) from public.consents c join auth.users u on u.id=c.user_id where u.email='${email}' and c.purpose='marketing' and not c.granted`) === "1");

  await login(page, email);
  check("Sin confirmar no ingresa", !page.url().includes("/cuenta"), page.url());

  const confirm = await latestMailLink(email, "/auth/confirmar");
  check("Correo de confirmación con token_hash", !!confirm && confirm.includes("token_hash"), confirm ?? "sin enlace");
  if (confirm) await page.goto(confirm);
  await page.waitForLoadState("networkidle");
  check("Confirmación lleva a la cuenta", page.url().includes("/cuenta"), page.url());

  // 2. A01: registro sin pago → sin acceso
  await page.goto(`${APP}/cuenta`);
  await settled(page);
  const cuenta0 = (await page.textContent("main")) ?? "";
  check("A01 Cuenta sin suscripción activa", !/activa hasta/i.test(cuenta0));

  // 3. Compra bloqueada sin compatibilidad (A15)
  const blocked = await page.evaluate(async () => {
    const r = await fetch("/api/compra", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acceptPurchaseTerms: true, acknowledgedDesktop: true, idempotencyKey: crypto.randomUUID() }) });
    return r.status;
  });
  check("A15 Compra sin compatibilidad verificada → 409", blocked === 409, String(blocked));

  // A04: manipulación del precio rechazada
  const tamper = await page.evaluate(async () => {
    const r = await fetch("/api/compra", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acceptPurchaseTerms: true, acknowledgedDesktop: true, idempotencyKey: crypto.randomUUID(), amount: 100 }) });
    return r.status;
  });
  check("A04 Campo de precio extra rechazado → 400", tamper === 400, String(tamper));

  // 4. Compatibilidad
  await page.goto(`${APP}/compatibilidad`);
  await page.click('button:has-text("Verificar")');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const compat = sql(`select count(*) from public.eligibility_checks e join auth.users u on u.id=e.user_id where u.email='${email}'`);
  check("Verificación de compatibilidad guardada", Number(compat) >= 1, compat);

  // 5. Compra con el simulador
  await page.goto(`${APP}/compra`);
  await settled(page);
  const compraText = (await page.textContent("main")) ?? "";
  const canBuy = await page.locator('input[name="terms"]').count();
  check("Página de compra habilitada tras compatibilidad", canBuy === 1, canBuy ? "" : compraText.slice(0, 200));
  if (canBuy) {
    await page.check('input[name="terms"]');
    await page.check('input[name="desktop"]');
    await page.click("form button");
    await page.waitForURL(/simulador/, { timeout: 15000 });
    check("Pasarela simulada abierta", page.url().includes("/compra/simulador"));
    const reference = new URL(page.url()).searchParams.get("referencia");
    await page.click('button:has-text("Aprobado"), button:has-text("aprobado"), button:has-text("Aprobar")');
    await page.waitForURL(/pago\/resultado/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const res = (await page.textContent("main")) ?? "";
    check("Resultado del pago visible", /aprobad|activ/i.test(res), res.replace(/\s+/g, " ").slice(0, 120));

    const sub = sql(`select s.status||'|'||to_char(s.current_period_end at time zone 'America/Bogota','YYYY-MM-DD HH24:MI') from public.subscriptions s join auth.users u on u.id=s.user_id where u.email='${email}'`);
    check("A03 Suscripción activa con vigencia mensual (hora de Colombia)", sub.startsWith("active|"), sub);
    const pays = sql(`select count(*) from public.payments p join public.orders o on o.id=p.order_id where o.reference='${reference}' and p.status='approved'`);
    check("Un único pago aprobado", pays === "1", pays);
    const lic = sql(`select coalesce(string_agg(l.status::text,','),'') from public.licenses l join public.subscriptions s on s.id=l.subscription_id join auth.users u on u.id=s.user_id where u.email='${email}'`);
    check("Licencia simulada activa", lic.includes("active"), lic);

    await page.goto(`${APP}/cuenta`);
    await settled(page);
    const cuenta1 = (await page.textContent("main")) ?? "";
    check("Cuenta muestra suscripción activa", /activa/i.test(cuenta1), cuenta1.replace(/\s+/g, " ").slice(0, 160));

    // A12: cancelar renovación conserva vigencia
    const cancel = await page.evaluate(async () => {
      const r = await fetch("/api/cuenta/renovacion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      return r.status;
    });
    const afterCancel = sql(`select s.status||'|'||s.cancel_at_period_end from public.subscriptions s join auth.users u on u.id=s.user_id where u.email='${email}'`);
    check("A12 Cancelar renovación conserva acceso", cancel === 200 && afterCancel.startsWith("active|t"), `${cancel} ${afterCancel}`);
  }

  // 6. A10: otro cliente no ve los datos del primero
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await register(p2, otherEmail);
  const confirm2 = await latestMailLink(otherEmail, "/auth/confirmar");
  check("Correo de confirmación del cliente B", !!confirm2);
  if (confirm2) await p2.goto(confirm2);
  await p2.waitForLoadState("networkidle");
  const SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const tok = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: otherEmail, password }),
  }).then((r) => r.json());
  const out = [];
  for (const t of ["orders", "payments", "subscriptions", "licenses", "profiles"]) {
    const r = await fetch(`${SB}/rest/v1/${t}?select=*`, { headers: { apikey: ANON, authorization: `Bearer ${tok.access_token}` } });
    const rows = r.ok ? await r.json() : [];
    out.push(`${t}:${Array.isArray(rows) ? rows.length : "?"}`);
  }
  // Intento de escritura directa: crear un pedido con precio propio
  const write = await fetch(`${SB}/rest/v1/orders`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ reference: "HACK-1", amount_cop: 1 }),
  }).then((r) => r.status);
  check("A04 Cliente no puede crear pedidos directamente en la API", write >= 400, String(write));
  const leaked = out.join(",");
  check("A10 Cliente B solo ve su propio perfil (RLS en Supabase real)", leaked === "orders:0,payments:0,subscriptions:0,licenses:0,profiles:1", leaked);
  await p2.goto(`${APP}/admin`);
  await p2.waitForURL((u) => !u.pathname.startsWith("/admin"), { timeout: 10000 }).catch(() => {});
  const adminBody = (await p2.textContent("body")) ?? "";
  check("Cliente sin rol no entra al panel admin", !p2.url().includes("/admin") && !adminBody.includes("Roles:"), p2.url());
  await ctx2.close();

  // 7. Panel administrativo
  sql(`insert into public.staff_roles (user_id, role) select id, 'admin' from auth.users where email='${email}' on conflict do nothing`);
  const adminPages = ["", "/clientes", "/pagos", "/licencias", "/soporte", "/comercial", "/reportes", "/configuracion"];
  const adminStatus = [];
  for (const p of adminPages) {
    const r = await page.goto(`${APP}/admin${p}`);
    adminStatus.push(`${p || "/"}:${r?.status()}${page.url().includes("/admin") ? "" : "→redirect"}`);
  }
  check("Admin: las 8 secciones cargan", adminStatus.every((s) => s.includes(":200") && !s.includes("redirect")), adminStatus.join(" "));
  await page.goto(`${APP}/admin/clientes`);
  await settled(page);
  check("Admin ve al cliente en la lista", ((await page.textContent("main")) ?? "").includes(email));

  // 8. Cron de vencimientos protegido
  const cronNoAuth = await fetch(`${APP}/api/cron/vencimientos`).then((r) => r.status);
  const cronAuth = await fetch(`${APP}/api/cron/vencimientos`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }).then((r) => r.status);
  check("Cron rechaza sin secreto y acepta con secreto", cronNoAuth === 401 && cronAuth === 200, `${cronNoAuth}/${cronAuth}`);

  // 9. A16: recuperación sin revelar cuentas + restablecimiento real
  await ctx.clearCookies();
  const msg = async (mail) => {
    await page.goto(`${APP}/recuperar-acceso`);
    await page.fill("#email", mail);
    await page.click("form button");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    return ((await page.textContent("main")) ?? "").replace(/\s+/g, " ");
  };
  const mExisting = await msg(email);
  const mMissing = await msg(`nadie.${stamp}@ejemplo.test`);
  check("A16 Mismo mensaje para cuenta existente e inexistente", mExisting === mMissing);
  const reset = await latestMailLink(email, "type=recovery");
  check("Correo de recuperación enviado", !!reset, reset ?? "sin enlace");
  if (reset) {
    await page.goto(reset);
    await page.waitForLoadState("networkidle");
    check("Recuperación lleva a /restablecer", page.url().includes("/restablecer"), page.url());
    const pwdInputs = page.locator('input[type="password"]');
    const n = await pwdInputs.count();
    for (let i = 0; i < n; i++) await pwdInputs.nth(i).fill(newPassword);
    await page.click("form button");
    await page.waitForLoadState("networkidle");
    await ctx.clearCookies();
    await login(page, email, newPassword);
    check("Ingreso con la nueva contraseña", page.url().includes("/cuenta") || page.url().includes("/admin"), page.url());
  }

  // Límite compartido: 5 intentos de ingreso por correo cada 15 minutos.
  await ctx.clearCookies();
  const victim = `bloqueo.${stamp}@ejemplo.test`;
  let lastMsg = "";
  for (let i = 0; i < 6; i++) {
    await login(page, victim, "incorrecta-123456");
    lastMsg = ((await page.textContent("main")) ?? "").replace(/\s+/g, " ");
  }
  check("Límite compartido bloquea el 6.º intento de ingreso", /Demasiados intentos/.test(lastMsg), lastMsg.slice(0, 80));

  check("Sin errores de JavaScript en el navegador", jsErrors.length === 0, jsErrors.slice(0, 3).join(" | "));
} catch (e) {
  check("Ejecución sin excepciones", false, String(e).slice(0, 300));
} finally {
  await browser.close();
}

console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} comprobaciones superadas`);
process.exit(failures ? 1 : 0);

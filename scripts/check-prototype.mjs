// Recorrido automatizado del prototipo con Playwright (escritorio + móvil).
// Uso: node scripts/check-prototype.mjs  (requiere playwright y navegadores instalados)
import { chromium } from "playwright";
import { resolve } from "node:path";

const file = "file://" + resolve("prototype/dist/index.html");
const results = [];
const ok = (name, cond, detail = "") => { results.push({ name, pass: !!cond, detail }); };
const browser = await chromium.launch();
// La navegación por #hash renderiza de forma asíncrona: esperar hasta 3 s antes de evaluar.
const vis = (loc) => loc.first().waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);

// ── Escritorio: recorrido completo de compra ──
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/fonts\.g|Failed to load resource/.test(m.text()) && errors.push(m.text()));
await page.goto(file + "#inicio");
ok("Inicio muestra 6 funciones", (await page.locator("article.card .feature-num").count()) === 6);
ok("Aviso de independencia visible", await vis(page.getByText("No tiene relación comercial ni institucional con el SENA")));
await page.goto(file + "#funciones");
ok("F01–F06 con estado 'Declarada'", (await page.locator(".badge", { hasText: "Declarada por el fabricante" }).count()) === 6);

await page.goto(file + "#compra");
ok("A01/compra exige sesión", await vis(page.getByText("Inicia sesión para continuar")));
await page.goto(file + "#registro");
await page.fill("#r-pass", "corta");
await page.click("#reg-form button");
ok("Registro valida contraseña y aceptación", await vis(page.locator("#reg-err")));
await page.fill("#r-pass", "claveSegura123");
await page.check("#r-terms"); await page.check("#r-priv");
await page.click("#reg-form button");
await page.click("#confirm-email");
ok("A01 registro sin pago → sin suscripción", await vis(page.getByText("Sin suscripción")));

// A15: entorno no verificado bloquea la compra
await page.selectOption("#sim-env", "0");
await page.goto(file + "#compra");
await page.click("#elig-form button");
ok("A15 entorno no verificado no permite comprar", (await vis(page.getByText("en verificación técnica"))) && (await page.locator("#checkout-form").count()) === 0);
await page.selectOption("#sim-env", "1");
await page.goto(file + "#compra");
await page.selectOption("#device", "celular");
await page.click("#elig-form button");
ok("A17 celular → no compatible", await vis(page.getByText("No funciona en celulares")));
await page.selectOption("#device", "portatil");
await page.click("#elig-form button");
ok("Compatibilidad verificada habilita confirmación", await vis(page.locator("#checkout-form")));
await page.check("#c-terms"); await page.check("#c-desk");
await page.click("#checkout-form button");
ok("Pasarela simulada abierta", await vis(page.getByText("Pasarela simulada")));
await page.click("[data-pay=forged]");
ok("A06 firma falsa rechazada", await vis(page.getByText("Evento rechazado")));

// A09: licencia pendiente
await page.selectOption("#sim-lic", "pending");
await page.goto(file + "#pasarela");
await page.click("[data-pay=approved]");
ok("A09 pago aprobado + licencia pendiente → activación pendiente", await vis(page.getByText("Pago recibido · activación pendiente")));
await page.goto(file + "#pasarela");
await page.click("[data-pay=dup]");
ok("A05 duplicado ignorado", await vis(page.getByText("Evento duplicado ignorado")));
// Reintento con licencias simuladas
await page.selectOption("#sim-session", "admin");
await page.selectOption("#sim-lic", "sim");
await page.goto(file + "#admin-licencias");
await page.click("[data-retry]");
await page.selectOption("#sim-session", "client");
ok("Reintento activa la licencia", await vis(page.getByText("Tu licencia está activa.")));
const endTxt = await page.locator("dd").nth(1).textContent();
ok("A21 vencimiento 10 dic 2026 hora de Colombia", /10 de dic.* 2026/.test(endTxt ?? ""), endTxt);

// A12: cancelar mantiene acceso
await page.click("#cancel-ask"); await page.click("#cancel-yes");
ok("A12 cancelación conserva acceso", await vis(page.getByText("Activa · no se renovará")));
for (let i = 0; i < 4; i++) await page.click("#sim-time");
ok("A11 tras el vencimiento → vencida", await vis(page.locator(".badge", { hasText: "Vencida" })));

// Admin: pago manual sin evidencia rechazado
await page.selectOption("#sim-session", "admin");
await page.goto(file + "#admin-pagos");
await page.click("#manual-form button");
ok("Pago manual exige evidencia", /evidencia|inválida/.test((await page.locator("#m-out").textContent()) ?? ""));
await page.goto(file + "#admin");
await page.screenshot({ path: "prototype/dist/admin-escritorio.png", fullPage: false });
await page.goto(file + "#inicio");
await page.screenshot({ path: "prototype/dist/inicio-escritorio.png", fullPage: false });
ok("Sin errores de JavaScript (escritorio)", errors.length === 0, errors.join(" | "));

// ── Móvil (A17) ──
const m = await browser.newPage({ viewport: { width: 375, height: 780 }, isMobile: true, hasTouch: true });
const merr = [];
m.on("pageerror", (e) => merr.push(e.message));
await m.goto(file + "#precio");
ok("A17 móvil: requisito de escritorio visible antes de pagar", await vis(m.getByText("no se instala ni se usa en navegadores móviles")));
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("A17 móvil: sin desplazamiento horizontal", overflow <= 0, `overflow=${overflow}`);
await m.click("#nav-toggle");
ok("A17 móvil: menú desplegable accesible", await vis(m.locator("#menu-principal a", { hasText: "Funciones" })));
await m.keyboard.press("Tab");
await m.screenshot({ path: "prototype/dist/precio-movil.png", fullPage: false });
ok("Sin errores de JavaScript (móvil)", merr.length === 0, merr.join(" | "));

// ── Accesibilidad básica: etiquetas en controles ──
const unlabeled = await page.evaluate(() => [...document.querySelectorAll("input, select, textarea")].filter((el) => !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.closest("label") && !el.getAttribute("aria-label") && el.type !== "hidden").map((el) => el.id || el.name));
ok("Controles con etiqueta (vista admin)", unlabeled.length === 0, unlabeled.join(","));

await browser.close();
for (const r of results) console.log(`${r.pass ? "✔" : "✘"} ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
process.exit(failed ? 1 : 0);

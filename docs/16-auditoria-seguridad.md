# 16. Auditoría de seguridad «Zero Trust» · 12-nov-2026

**Alcance:** el código del repositorio (`main` v0.3.0 → v0.4.0), las migraciones de Supabase, la configuración de Next.js y pruebas locales no destructivas. Se usaron datos ficticios y no hubo acceso a producción.
**Sin acceso durante la auditoría (NO VERIFICADO):** el proyecto Supabase alojado, el panel de Vercel, el DNS y el dominio, Wompi (aún sin llaves), el sistema de licencias de la extensión, las copias de seguridad reales y las cuentas de proveedores (GitHub, Vercel, Supabase y Google).
**Entorno de pruebas:** Linux, Node 22, Next.js 16.4.6, PostgreSQL temporal con el esquema `auth` simulado, Chromium (Playwright) y un servidor falso de Supabase Auth para las pruebas de cookies. No había Docker, así que **la prueba de punta a punta contra Supabase local (`npm run test:e2e`) no se ejecutó** en esta auditoría; su último resultado verde es del 11-nov (v0.2.0).

> Ningún sistema es invulnerable. Este informe distingue entre lo **demostrado** (con prueba ejecutada) y lo **NO VERIFICADO**.

---

## A. Resumen ejecutivo

**Estado general: bueno para un prototipo y con buena base para producción, pero con pendientes que dependen de configuración y de decisiones del propietario.**

La arquitectura ya seguía buenas prácticas:
- Las contraseñas las gestiona Supabase Auth; la aplicación nunca las guarda.
- RLS (seguridad por fila) está forzado en todas las tablas.
- Las funciones privilegiadas están cerradas al navegador.
- Los webhooks están firmados y se confirman con la pasarela.
- El precio se toma del servidor, nunca del navegador.
- La auditoría es inmutable.

No se encontraron vulnerabilidades críticas (P0) ni fugas de contraseñas o secretos.

Se corrigieron 8 debilidades, todas con pruebas de regresión:

| Corregido | Por qué importa |
|---|---|
| Redirección abierta tras confirmar el correo | Un enlace podía terminar en un sitio de phishing |
| Cookie de sesión legible por JavaScript y sin `Secure` | Un XSS habría robado la sesión |
| Política de contraseñas débil (10 caracteres con reglas de composición) | Ahora son 15 caracteres, sin reglas arbitrarias, con lista de rechazo y consulta de filtraciones |
| El cambio de contraseña no cerraba las otras sesiones | Un atacante con la sesión robada la conservaba |
| Webhooks falsos escribían en la base sin límite | Permitía llenar la base de datos |
| Consultas que dependían solo de RLS en cuentas del personal | Defensa en profundidad |
| Cabeceras de seguridad incompletas | `object-src`, COOP y Referer en las páginas de acceso |
| El webhook revelaba su resultado interno en una cabecera | Fuga de información |

**Decisiones que requieren tu aprobación** (detalle en H):
1. **MFA (segundo factor) obligatorio para administradores.** Es el riesgo abierto más importante: hoy una contraseña robada de un admin permite registrar pagos manuales y activar licencias.
2. Eliminación y exportación de datos por el propio usuario (derechos de la Ley 1581).
3. CSP con *nonce* para eliminar `'unsafe-inline'`. Obliga a renderizar todas las páginas en el servidor.
4. Ajustes que solo puedes hacer tú en los paneles de Supabase y Vercel (sección I).

---

## B. Matriz de vulnerabilidades

| ID | Vulnerabilidad | Sev. | CWE | Evidencia | Estado | Acción |
|---|---|---|---|---|---|---|
| SEC-001 | Redirección abierta en `/auth/confirmar?siguiente=/\host`: `new URL("/\\evil", base)` resuelve a `https://evil/` | P2 | 601 | Demostrada con `node -e` y luego bloqueada en el navegador (ingresar con `?siguiente=/%5Cevil.example` lleva a `/cuenta`) | **Corregido** | `src/lib/security/redirect.ts` (`safeInternalPath`), usado en el ingreso y en la confirmación. Prueba `SEC-REDIR-01` |
| SEC-002 | Cookies de sesión `sb-*` sin `HttpOnly` ni `Secure` (valores por defecto de `@supabase/ssr`) | P2 | 1004, 614 | `node_modules/@supabase/ssr/dist/main/utils/constants.js`: `httpOnly: false` | **Corregido** | `src/lib/supabase/cookie-options.ts`. Verificado en el navegador: `Secure; HttpOnly; SameSite=lax`, y `document.cookie` no ve la sesión. Se eliminó el cliente de navegador sin uso (`supabase/browser.ts`) |
| SEC-003 | Política de contraseñas débil: 10 caracteres con reglas de composición; mínimo de Supabase local en 6; sin consulta de filtraciones en el plan gratuito | P2 | 521 | `src/lib/validation.ts` (antes), `supabase/config.toml:183` | **Corregido en código**; **pendiente en el panel** | Mínimo 15 y máximo 128, sin reglas de composición, rechazo de contraseñas triviales, repetitivas o con datos de la cuenta, y consulta en Have I Been Pwned con k-anonimato. Pruebas `SEC-PWD-01…04` |
| SEC-004 | El cambio de contraseña en `/restablecer` no exigía reautenticación, no tenía límite y no cerraba las demás sesiones | P2 | 620, 613 | `src/app/auth-actions.ts` (antes) | **Parcial** | Ahora tiene límite (5 en 15 min), aplica la política, cierra las demás sesiones (`signOut({ scope: "others" })`) y `secure_password_change = true` en el `config.toml` local. **Falta activarlo en el panel de Supabase** |
| SEC-005 | Escritura sin autenticación en `payment_events`: cada webhook con firma falsa insertaba una fila | P2 | 770 | `payment-processor.ts` (antes); prueba HTTP: la firma falsa daba 500 al fallar el registro | **Corregido** | El registro de rechazos tiene límite por IP (30 en 10 min) y, si falla, la respuesta sigue siendo 401. Prueba `SEC-WH-01` |
| SEC-006 | Consultas que dependían solo de RLS: en cuentas del personal, `staffRoles()`, `/api/pago/estado` y el consentimiento del perfil podían leer filas de otros usuarios (sin escalamiento demostrado) | P3 | 639 | `src/lib/auth.ts`, `api/pago/estado`, `cuenta/actions.ts` | **Corregido** | Filtro explícito `user_id = auth.user.id` y validación del formato de la referencia |
| SEC-007 | Cabeceras incompletas: sin `object-src`, sin COOP y con el Referer activo en las páginas de acceso | P3 | 1021 | `curl -I` | **Corregido** | `object-src 'none'`, COOP `same-origin`, `upgrade-insecure-requests` en producción y `no-store` + `no-referrer` en ingreso, registro, recuperación y restablecimiento |
| SEC-008 | La cabecera `x-luria-outcome` del webhook revelaba el resultado interno | P3 | 200 | `route.ts` (antes) | **Corregido** | Cabecera eliminada |
| SEC-009 | **Administradores sin MFA.** Con solo la contraseña se pueden registrar pagos manuales, reintentar activaciones y ver datos personales | P1 | 308 | No existe ninguna comprobación AAL2 en `src/lib/auth.ts` | **Abierto, requiere aprobación** | Plan en H-1 |
| SEC-010 | CSP con `script-src 'unsafe-inline'` en producción, lo que debilita la defensa contra XSS (no se encontró ningún XSS) | P2 | 1021 | `next.config.ts` | **Abierto (residual)** | Plan en H-3 |
| SEC-011 | Sin flujo de supresión ni exportación de datos personales | P2 | — (Ley 1581) | No existe la ruta | **Abierto, requiere decisión** | Plan en H-2 |
| SEC-012 | El límite por correo en el ingreso (5 en 15 min) permite bloquear temporalmente a una persona concreta | P3 | 645 | `auth-actions.ts` | **Aceptado** | Compensación consciente frente al relleno de credenciales; el bloqueo dura 15 min y la recuperación por correo sigue disponible |
| SEC-013 | Las pruebas SQL no imitaban los permisos por defecto de Supabase y podían pasar por alto tablas o funciones abiertas | P3 | — | `supabase/tests/00_supabase_stub.sql` | **Corregido** | Ahora imitan esos permisos, con 10 invariantes nuevas (`40_zero_trust.sql`) y una mutación de control que las hace fallar |

---

## C. Auditoría de contraseñas

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿Se almacenan en texto plano? | **No.** Ninguna tabla de `public` tiene columnas de contraseña. Supabase Auth guarda solo el hash en `auth.users`; según su documentación es **bcrypt** (no se pudo inspeccionar el proyecto alojado) | Búsqueda de `password`, `clave` y `secret` en las migraciones: 0 columnas |
| ¿Pueden recuperarse las originales? | **No.** Un hash bcrypt no es reversible, y la aplicación no tiene ninguna función de lectura ni de descifrado | Revisión de código |
| ¿Puede verlas un administrador? | **No.** El panel no lee `auth.users` y ninguna API devuelve hashes | `src/app/admin/**` |
| ¿Puede otro usuario acceder a ellas? | **No.** `auth.users` no está expuesta en la API REST de Supabase, y la aplicación no tiene vistas sobre ella | Migraciones |
| ¿Se filtran en el frontend? | **No.** Solo existen como `type="password"` en los formularios; las acciones de servidor no devuelven el valor | Revisión de `auth-actions.ts`, `RegisterForm.tsx` y `restablecer/page.tsx` |
| ¿Se filtran en logs o en analítica? | **No.** El único `console.error` es el del webhook, que solo registra el mensaje de error. La analítica envía `event`, `anonId`, `path` y `channel` | Búsqueda en `src` |
| ¿Es segura la recuperación? | **Sí en código.** Usa `token_hash` de un solo uso con vencimiento de 1 h (configurado), el mismo mensaje exista o no la cuenta (A16), un límite por IP, sin Referer y destino solo interno. Al cambiar la contraseña se cierran las demás sesiones | `auth-actions.ts`, `auth/confirmar`, `next.config.ts` |
| ¿Hay credenciales expuestas? | **No.** Se revisó el árbol y **todo el historial de Git** buscando llaves JWT, `sb_secret_`, llaves de Wompi, llaves privadas y tokens de AWS o GitHub, sin resultados. Una compilación de producción con secretos marcados no dejó **ninguno** en `.next/static`, y no hay *source maps* públicos | Comandos en la sección G |

**Envío a terceros:** para la consulta de filtraciones solo se envían a `api.pwnedpasswords.com` los **5 primeros caracteres del SHA-1** (k-anonimato). Nunca salen del servidor la contraseña, su hash completo ni datos de la persona. Se desactiva con `PASSWORD_BREACH_CHECK=off`.

---

## D. Usuarios y permisos (pruebas entre cuentas ficticias)

Cuentas de prueba: cliente A, cliente B, comercial y admin (UUID ficticios). Resultado en `npm run test:sql` (todas pasaron):

| Prueba | Qué se intentó | Resultado |
|---|---|---|
| A10 | B lee pedidos, pagos, suscripciones, licencias y perfiles de A | 0 filas |
| ZT-07 | B lee soporte, consentimientos, elegibilidad, periodos y roles de A; lee atribución y límites; escribe a nombre de A | Lecturas vacías o denegadas; escrituras denegadas; `UPDATE` sobre soporte de A afecta 0 filas |
| ZT-06 | B se inserta `admin` en `staff_roles`; llama `fn_register_manual_payment`, `fn_create_order`, `fn_mark_license_active` y `fn_rate_limit_hit` | 5 de 5 denegadas (`insufficient_privilege`) |
| ZT-08 | B cambia su correo o la fecha de creación en `profiles` | Denegado (solo puede cambiar nombre y teléfono) |
| ZT-09 | El comercial lee roles ajenos o se asciende a admin | 0 filas; inserción denegada |
| Comercial | Lee eventos técnicos, auditoría, licencias o soporte | 0 filas |
| Anónimo | Lee pedidos | Denegado; solo ve el catálogo |
| HTTP | `/admin`, `/cuenta`, APIs de admin, compra, estado del pago y cron sin sesión o con Origin ajeno | 307 a ingreso / 401 / 403 |

**Matriz de permisos** (L = leer, E = escribir; «propio» significa solo sus filas):

| Recurso | Anónimo | Cliente | Soporte | Comercial | Admin | Servidor (service_role) |
|---|---|---|---|---|---|---|
| Catálogo (productos, funciones, entornos) | L | L | L | L | L + E | Todo |
| Perfil | — | L/E propio (nombre, teléfono) | L | L | L | Todo |
| Roles del personal | — | L propio | L propio | L propio | L | Todo |
| Pedidos | — | L propio | L | L | L | E vía funciones |
| Pagos | — | L propio | — | L | L | E vía funciones |
| Suscripciones y periodos | — | L propio | L | L | L | E vía funciones |
| Licencias | — | L propio | L | — | L | E vía funciones |
| Eventos de pago, auditoría | — | — | — | — | L | E (auditoría solo inserción) |
| Tareas de activación | — | — | L | — | L | E |
| Soporte | — | L/crear propio | L + estado/asignación | — | L + estado | Todo |
| Consentimientos | — | L/crear propio | — | — | L | Todo |
| Referidos, atribución, comisiones, analítica | — | — | — | L | L | E |
| Límites de solicitudes | — | — | — | — | — | Solo vía función |
| Pago manual (API) | — | — | — | — | Sí (la función SQL verifica de nuevo el rol) | — |
| Cancelar o reanudar renovación | — | Propia (función) | — | — | — | — |

---

## E. Base de datos (Supabase / PostgreSQL)

Invariantes globales que **fallan automáticamente** si una migración futura las rompe (`supabase/tests/40_zero_trust.sql`):
- **ZT-01:** las 21 tablas de `public` tienen RLS activado **y forzado**.
- **ZT-02:** ninguna función `SECURITY DEFINER` es ejecutable por `anon`. `authenticated` solo puede ejecutar `has_role`, `is_staff`, `fn_cancel_renewal` y `fn_resume_renewal`.
- **ZT-03:** toda función `SECURITY DEFINER` fija `search_path`.
- **ZT-04:** `anon` solo puede hacer `SELECT` sobre `products`, `features` y `environments`.
- **ZT-05:** `authenticated` no tiene `DELETE`, `TRUNCATE`, `TRIGGER` ni `REFERENCES` en ninguna tabla, ni `INSERT` o `UPDATE` en datos financieros, de roles, de auditoría o de analítica.
- **ZT-10:** `audit_log` no admite `UPDATE` ni siquiera con `service_role`.

**Control de la prueba:** se añadió una migración temporal que quitaba el RLS forzado de `rate_limits` y abría `fn_create_order`. La prueba falló con «tablas sin RLS forzado: rate_limits». Después se retiró la migración.

**Otros controles verificados en el código:**
- Inyección SQL: no hay SQL dinámico con datos de usuario; todo pasa por el cliente de Supabase o por funciones con parámetros.
- El pedido y el pago se bloquean (`FOR UPDATE`) dentro de una transacción.
- El precio se protege con el trigger `orders_price_guard`.
- Las referencias son únicas.
- Los perfiles se crean con un trigger `SECURITY DEFINER` al registrarse.

**NO VERIFICADO (requiere el panel de Supabase):**
- El cifrado en reposo (Supabase lo documenta con AES-256).
- Las restricciones de red de la base de datos.
- La rotación de las llaves `service_role`.
- Las copias de seguridad y su restauración.
- Storage: no se usa (no hay buckets en el código).
- Edge Functions: no se usan.

---

## F. Pagos y suscripciones

| Control | Estado | Evidencia |
|---|---|---|
| Firma del webhook (SHA-256, tiempo constante, cabecera y cuerpo) | ✔ | `wompi.ts`, prueba A06 |
| Repetición: antigüedad máxima e idempotencia (`dedupe_key`, `(provider, tx)` único) | ✔ | A05, A06 |
| Confirmación con la API de Wompi (no se confía en el evento) | ✔ | `fetchTransaction`, `payment-processor.ts` |
| Monto y moneda verificados en el servidor contra el pedido; si no coinciden, se marca discrepancia y no se activa nada | ✔ | `fn_apply_payment`, A04 |
| Precio desde la base de datos; el navegador no puede enviar el monto (`.strict()`) | ✔ | `createOrderSchema`; HTTP con `{"amount":1}` → rechazado |
| Activación solo tras el pago verificado; reembolsos y reversiones revocan la licencia | ✔ | A03, A07, A13 |
| Simulador inaccesible en producción y arranque bloqueado si hay piezas simuladas | ✔ | HTTP 404; `assertSafeConfig` |
| Pago manual solo de un admin, con evidencia y referencia única | ✔ | `fn_register_manual_payment` (verifica el rol en SQL), ZT-06 |
| Webhooks falsos no llenan la base de datos | ✔ (nuevo) | SEC-005 |
| Datos de tarjeta | No pasan por LURIA: Web Checkout de Wompi (alcance PCI DSS tipo SAQ A, a confirmar con Wompi) | Diseño |
| **Pruebas en sandbox de Wompi** | **NO VERIFICADO** (faltan las llaves) | `08-despliegue.md` §2 |

---

## G. Correcciones de código

| Archivo | Cambio | Justificación | Prueba |
|---|---|---|---|
| `src/lib/security/redirect.ts` (nuevo) | `safeInternalPath` | SEC-001 | `SEC-REDIR-01`; navegador |
| `src/app/auth/confirmar/route.ts`, `src/app/auth-actions.ts` | Usan `safeInternalPath` | SEC-001 | Ídem |
| `src/lib/supabase/cookie-options.ts` (nuevo), `server.ts`, `proxy.ts` | Cookies `HttpOnly`, `Secure` y `SameSite=Lax` | SEC-002 | Navegador con Auth simulado |
| `src/lib/supabase/browser.ts` (eliminado) | Cliente de navegador sin uso | Incompatible con HttpOnly; reduce la superficie | `tsc`, `build` |
| `src/lib/security/password.ts`, `breach.ts` (nuevos); `validation.ts`; `RegisterForm.tsx`; `restablecer/page.tsx` | Política de 15 caracteres y consulta de filtraciones | SEC-003 | `SEC-PWD-01…04` |
| `src/app/auth-actions.ts` | Reset: sesión obligatoria, límite, política, filtraciones y cierre de las demás sesiones | SEC-004 | Revisión y `tsc` (la prueba de punta a punta no se ejecutó, ver el alcance) |
| `src/lib/services/payment-processor.ts`, `webhook/[provider]/route.ts` | Límite de rechazos registrados, 401 aunque falle la base y sin cabecera de resultado | SEC-005, SEC-008 | `SEC-WH-01`, A06 |
| `src/lib/auth.ts`, `api/pago/estado/route.ts`, `cuenta/actions.ts` | Filtros explícitos por propietario | SEC-006 | `tsc`, ZT-07 |
| `next.config.ts` | Cabeceras adicionales | SEC-007 | `curl -I` (7/7 cabeceras) |
| `supabase/config.toml` | Mínimo de 15, `secure_password_change`, 60 s entre correos | SEC-003, SEC-004 (solo local) | — |
| `supabase/tests/00_supabase_stub.sql`, `40_zero_trust.sql`, `scripts/test-sql.sh` | Permisos por defecto de Supabase y 10 invariantes | SEC-013 | Mutación de control |
| `tests/acceptance.test.ts`, `scripts/check-prototype.mjs`, `prototype/template.html` | Contraseñas de prueba y texto del prototipo con la nueva política | Coherencia | 36/36, 24/24 |

**Efectos secundarios posibles:**
- Quien tenga una contraseña de menos de 15 caracteres **puede seguir ingresando**; la regla solo se aplica al crearla o cambiarla.
- Si Have I Been Pwned no responde en 2 s, el registro continúa (falla abierta).
- Las cookies HttpOnly impiden usar Supabase desde el navegador. Hoy no se usa, pero si en el futuro se necesita, debe hacerse a través del servidor.

**Resultados de regresión (12-nov-2026):**

| Prueba | Resultado |
|---|---|
| `npm test` | 36/36 |
| `npm run typecheck` | 0 errores |
| `npm run test:sql` | Todo superado, incluidos ZT-01…10 |
| `next build` | OK |
| Prototipo | 24/24 |
| `npm audit` | 0 vulnerabilidades |
| Pruebas HTTP sin sesión sobre la compilación de producción | Todas con el código esperado (sección D) |
| `npm run test:e2e` | **No ejecutada** (sin Docker) |

---

## H. Riesgos residuales y decisiones pendientes

**H-1 · MFA para el personal (SEC-009, P1). Requiere aprobación.**
Plan:
1. Activar TOTP en Supabase Auth (incluido en el plan gratuito).
2. Crear la página `/admin/seguridad` para inscribir el factor (código QR) y verificarlo.
3. En `requireRole` y en las APIs de admin, exigir `aal2` (`auth.mfa.getAuthenticatorAssuranceLevel()`); si no se cumple, redirigir al desafío.
4. Activarlo con la variable `STAFF_MFA_REQUIRED=true` **solo después** de que cada admin se haya inscrito, para no dejar a nadie sin acceso.

Riesgo de no hacerlo: con un phishing a un admin, alguien registra pagos falsos y activa licencias.

**H-2 · Supresión y exportación de datos (SEC-011, P2). Requiere decisión.**
Los registros contables y de pago deben conservarse por obligación tributaria, así que la supresión debe **anonimizar** el perfil y conservar pedidos y pagos.

Propuesta:
- Un botón «Solicitar eliminación de mi cuenta» que cree una solicitud de soporte de categoría privacidad.
- Una función SQL de admin que revoque la licencia, anonimice nombre, correo y teléfono, y elimine el usuario de Auth.
- Una exportación JSON de los datos propios.

Mientras tanto, se atienden por el canal de PQR (plazo legal de 15 días hábiles). La revisión jurídica está en `11-legal-pendiente.md`.

**H-3 · CSP con nonce (SEC-010, P2).**
Next.js 16 lo permite desde `proxy.ts` (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`), pero obliga a que **todas** las páginas se generen en el servidor, con más costo y latencia. No se encontró ningún XSS: React escapa todo, no hay `dangerouslySetInnerHTML` ni `innerHTML`, y la sesión ya es HttpOnly. Recomendación: hacerlo cuando haya contenido de terceros o antes de abrir al público.

**H-4 · Otros riesgos aceptados o fuera del código:**
- **Vida de la sesión:** la cookie dura 400 días por la librería, aunque la sesión real depende del refresh token de Supabase. Con Supabase Pro, configurar *Time-box* y *Inactivity timeout* de sesión.
- **IP de cliente:** se toma de `x-forwarded-for`. Vercel la sobrescribe con la IP real; en un VPS propio, el proxy inverso debe limpiar esa cabecera.
- **Riesgos de la extensión** (datos de aprendices, acciones masivas): están fuera del alcance web y se tratan en `06-seguridad-privacidad.md`.
- **Inteligencia artificial:** la aplicación **no integra modelos de IA**, así que los riesgos de inyección de prompts no aplican. Las amenazas automatizadas se mitigan con los límites de solicitudes (registro, ingreso, recuperación, compra, soporte, elegibilidad, analítica y rechazos de webhook) y con la protección DDoS de Vercel. **No hay WAF ni CAPTCHA**: si aparece abuso, añadir Vercel Firewall o Cloudflare Turnstile en el registro.

---

## I. Lista de verificación de lanzamiento

**Supabase (panel):**
- [ ] Authentication → Policies o Sign In / Providers: **Minimum password length = 15**.
- [ ] **Secure password change** (pedir inicio de sesión reciente para cambiar la contraseña): activado.
- [ ] **Leaked password protection**: activar si el plan lo ofrece (Pro). En el plan gratuito, la aplicación ya consulta Have I Been Pwned.
- [ ] Email OTP Expiration = 3600 s; SMTP propio configurado.
- [ ] Rate limits de Auth revisados (correos por hora y verificaciones).
- [ ] MFA TOTP activado (necesario para H-1).
- [ ] Site URL y Redirect URLs **solo** con el dominio real; sin `localhost` en producción.
- [ ] Ninguna tabla con la etiqueta «Unrestricted» en Table Editor. Ejecutar *Security Advisor* y *Performance Advisor* sin alertas.
- [ ] `service_role` solo en Vercel; rotarla si alguna vez se pegó en un chat, un correo o una captura.
- [ ] Plan Pro con copias diarias y una restauración probada en staging.

**Vercel:**
- [ ] `APP_ENV=production`, `NEXT_PUBLIC_APP_URL=https://…`, `CRON_SECRET` aleatorio de 32 bytes o más.
- [ ] Variables secretas marcadas como *Sensitive*; las de *Preview* separadas de las de *Production*.
- [ ] Deployment Protection en las vistas previas.
- [ ] Dominio propio con HTTPS; HSTS activo (ya lo envía la aplicación en producción).

**Cuentas y cadena de suministro:**
- [ ] **MFA en GitHub, Vercel, Supabase, Google (Gmail de notificaciones) y Wompi.**
- [ ] Protección de la rama `main` en GitHub (PR obligatorio y sin *force push*).
- [ ] Dependabot o Renovate activado; `npm audit` en CI.
- [ ] La contraseña de aplicación de Gmail guardada solo en Supabase.

**Pagos:**
- [ ] Pruebas en sandbox de Wompi: pago aprobado, rechazado, pendiente y duplicado; webhook con firma inválida que debe dar 401.
- [ ] Llaves de producción y URL de eventos de producción.

**Aplicación:**
- [ ] H-1 (MFA del personal) implementado o aceptado por escrito.
- [ ] `npm test`, `npm run test:sql`, `npm run typecheck`, `npm run build` y `npm run test:e2e` en verde.
- [ ] Textos legales revisados (política de tratamiento y canal de PQR).

---

## J. Plan de mantenimiento

| Frecuencia | Actividad |
|---|---|
| **Semanal** | Revisar alertas de Dependabot y `npm audit`. Revisar en `/admin` las tareas de activación fallidas y los pagos con discrepancia. Revisar en Supabase Auth → Logs los picos de ingresos fallidos |
| **Mensual** | Actualizar dependencias menores con la batería de pruebas completa. Revisar `audit_log` (pagos manuales y cambios de rol). Revisar quién tiene roles en `staff_roles` y retirar los que no se usen. Ejecutar *Security Advisor* de Supabase |
| **Trimestral** | Probar una restauración en staging. Rotar `CRON_SECRET` y revisar las llaves de Wompi y Supabase. Repetir esta auditoría (sección D y pruebas HTTP). Revisar CSP y cabeceras. Revisar los textos legales y la retención de datos |
| **Ante incidentes** | Ver la sección K |

---

## K. Respuesta a incidentes (resumen operativo)

| Incidente | Señales | Severidad | Contención inmediata | Erradicación y recuperación |
|---|---|---|---|---|
| Robo de credenciales de un cliente | Ingresos desde lugares raros, quejas | Media | Supabase → Users → *Sign out user*; forzar recuperación | El cliente cambia la contraseña (se cierran las demás sesiones); revisar sus pedidos |
| Compromiso de un admin | Pagos manuales o roles inesperados en `audit_log` | **Crítica** | Borrar su fila de `staff_roles` y cerrar su sesión | Revisar y reversar pagos manuales; implementar H-1; rotar llaves |
| Exposición de `service_role` o de secretos | Llave vista en un repositorio, chat o captura | **Crítica** | Rotar la llave en Supabase (Settings → API) y actualizar Vercel; redeploy | Revisar los logs de la API de Supabase desde la fecha de exposición |
| Filtración de la base de datos | Datos en internet, accesos anómalos | **Crítica** | Rotar todas las llaves y aislar el proyecto | Notificar a la SIC y a los titulares según la Ley 1581 (asesoría jurídica); análisis posterior |
| Manipulación de pagos | Discrepancias, webhooks 401 masivos | Alta | Pausar las compras (`SUPPORTED_ENVIRONMENTS_VERIFIED=false` bloquea nuevos pedidos) | Conciliar con el panel de Wompi; los eventos son idempotentes |
| Caída o DDoS | Errores 5xx o latencia | Alta | Vercel Firewall, modo *Attack Challenge* | Revisar los límites de solicitudes |
| Vulnerabilidad en una dependencia | Alerta de Dependabot o CVE | Según CVSS | Evaluar si es explotable en LURIA | Actualizar, ejecutar todas las pruebas y desplegar |

En todos los casos: conservar evidencia (exportar `audit_log`, `payment_events` y los logs de Vercel y Supabase) **antes** de modificar datos.

**Objetivos propuestos (a confirmar con el negocio):**
- **RPO 24 h:** máximo un día de datos perdidos, por la copia diaria de Supabase Pro.
- **RTO 4 h:** máximo cuatro horas para volver a estar en línea, restaurando en un proyecto nuevo y cambiando las variables en Vercel (`08-despliegue.md` §5).

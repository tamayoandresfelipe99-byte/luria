# 13. Pruebas y resultados

**Fecha:** 10-nov-2026, 22:47 UTC (17:47 hora de Colombia).
**Entorno:** contenedor Linux, Node.js 22.23.4, PostgreSQL 16.15, TypeScript 6.0.3 (verificación), Chromium de Playwright 1.63.
**Evidencia:** salidas completas en `docs/evidencias/` (`pruebas-unitarias.txt`, `pruebas-sql.txt`, `pruebas-prototipo.txt`, `verificacion-tipos.txt`) y capturas `*.png`.

## Resumen

| Suite | Comando | Resultado observado |
|---|---|---|
| Dominio, pagos, licencias y contenido | `npm test` | **30/30** superadas |
| Base de datos (migraciones, funciones, RLS) | `npm run test:sql` | **23/23** bloques superados |
| Prototipo (escritorio y móvil) | `node scripts/check-prototype.mjs` | **24/24** comprobaciones superadas |
| Tipos (TypeScript estricto, `noUncheckedIndexedAccess`) | `tsc --noEmit` | 0 errores (ver la nota sobre stubs) |
| Compilación Next.js | `npm run build` | **Superada** (11-nov-2026, ver anexo): 34 rutas generadas, Next.js 16.4.6 |

Las pruebas se validaron a sí mismas: una aserción SQL alterada a propósito y un componente cliente con un secreto insertado a propósito hicieron fallar sus suites, como se esperaba.

## Casos de aceptación

| Caso | Dónde se prueba | Resultado | Observación |
|---|---|---|---|
| A01 Registro sin pago no da acceso | TS, prototipo | ✔ | |
| A02 Rechazar marketing no bloquea | TS | ✔ | |
| A03 Pago aprobado → una vigencia | TS, SQL | ✔ | Vence 10-dic-2026 23:59:59.999 Bogotá |
| A04 Manipulación de precio o estado | TS (esquema `.strict`, importe, estado declarado vs. consultado), SQL (trigger, discrepancia) | ✔ | |
| A05 Webhook duplicado | TS, SQL, prototipo | ✔ | Sin duplicar vigencia, licencia ni comisión |
| A06 Evento falso | TS (firma falsa, cuerpo alterado, evento viejo), prototipo | ✔ | 401 |
| A07 Eventos fuera de orden | TS, SQL | ✔ | Estado atrasado → noop; contradicción → revisión |
| A08 Pendiente o rechazado sin acceso | TS | ✔ | |
| A09 Pago OK + fallo de licencia → tarea | TS, SQL, prototipo | ✔ | Tarea idempotente |
| A10 Pedido ajeno denegado | SQL (RLS real) | ✔ | Probado con roles `authenticated`/`anon` y `auth.uid()` emulado |
| A11 Vencido → bloqueado | TS, SQL (`fn_expire_due`), prototipo | ✔ (lado web) | El bloqueo efectivo depende de la extensión (pendiente) |
| A12 Cancelación conserva acceso | TS, SQL, prototipo | ✔ | |
| A13 Reintentos de renovación | TS, SQL | ✔ | |
| A14 Reembolso o reversión | TS, SQL | ✔ | |
| A15 Entorno no verificado | TS, prototipo | ✔ | |
| A16 Recuperación sin revelar cuentas | TS (mensaje idéntico) | ✔ parcial | Falta probar el flujo real con Supabase Auth |
| A17 Móvil y accesible | Prototipo a 375 px | ✔ parcial | Sin desplazamiento horizontal, menú móvil, requisito visible. Falta auditoría con lector de pantalla |
| A18 Retiro de consentimiento | TS | ✔ | |
| A19 Sin secretos en el frontend | TS (análisis estático de componentes cliente y `.env.example`), bundle de `next build` | ✔ | 0 coincidencias de nombres de secretos en `.next/static` |
| A20 Sin simulaciones en producción | TS (`assertSafeConfig`, bloqueadores) | ✔ | |
| A21 Fechas y zona horaria | TS, SQL, prototipo | ✔ | 31→28/29→31, diciembre→enero, bisiesto, renovación tardía |
| A22 Licencia sin conexión | TS (token Ed25519) | ✔ (opción B) | Depende de que la extensión adopte un mecanismo |
| F01–F06 Contenido de funciones | TS, prototipo | ✔ | Textos íntegros, estado «declarada», sin exportaciones ni tiempos inventados |

## Lo que NO se ha probado

1. ~~`next build` y las páginas renderizadas por Next.js~~ Resuelto (ver anexo). Falta recorrer los flujos con sesión contra Supabase real.
2. Supabase real: Auth, plantillas de correo y RLS en la plataforma (se probó RLS en PostgreSQL puro con `auth.uid()` emulado).
3. Wompi sandbox: checkout, firma de integridad y eventos reales.
4. Adaptador HTTP de licencias contra un servidor real (no existe).
5. Pruebas de carga y concurrencia de webhooks simultáneos (`FOR UPDATE` en `fn_apply_payment` está diseñado para eso, pero no se ejecutó en paralelo).

**Nota sobre la verificación de tipos:** se usaron declaraciones mínimas («stubs») para `next`, `react` y `@supabase/*` porque los paquetes no estaban instalados. Detecta errores en el código propio, pero no incompatibilidades con las APIs reales de esas librerías. `npm run typecheck` con las dependencias instaladas es la verificación definitiva.

## Cómo repetirlas en Claude Code o en tu equipo

```bash
npm install && npm test && npm run test:sql && npm run typecheck && npm run build
npx playwright install chromium && npm run prototype:build && node scripts/check-prototype.mjs
```


## Anexo · Compilación y verificación con dependencias reales (10-nov-2026, Claude Code)

**Entorno:** Node.js 22.23.4, npm 10.9.9, Next.js 16.4.6, React 19.3.1, TypeScript 5.9.3, `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.7.0, PostgreSQL 16, Chromium de Playwright. Versiones fijadas en `package-lock.json`.

| Suite | Resultado |
|---|---|
| `npm install` | Sin errores |
| `npm run typecheck` | Inicialmente 23 errores, todos por el tipado del cliente *service role* (`ReturnType<typeof createClient>` se resolvía con esquema `never`). Corregido tipándolo como `SupabaseClient` en `src/lib/supabase/admin.ts`. Ahora **0 errores** |
| `npm test` | **30/30** |
| `npm run test:sql` | **23/23** bloques |
| `npm run build` | **Superada**: 34 páginas generadas, proxy activo |
| `next start` + solicitudes HTTP | Páginas públicas (`/`, `/funciones`, `/compatibilidad`, `/demostracion`, `/precio`, `/instalacion`, `/soporte`, `/legal/terminos`, `/ingreso`, `/registro`) responden 200; `/cuenta` y `/admin` redirigen (307) sin sesión; ruta inexistente → 404. Inicio sin errores de JavaScript en Chromium |
| `npm run prototype:build` + `node scripts/check-prototype.mjs` | **24/24** |
| A19 sobre el bundle | 0 coincidencias de nombres de secretos de servidor en `.next/static` |

`next build` reescribió `tsconfig.json` (`jsx: react-jsx`, inclusión de `.next/dev/types`) y `next-env.d.ts`, como exige Next.js 16.

**Sigue sin probarse:** Supabase real (Auth, correos, RLS en la plataforma), sandbox de Wompi y la API de licencias; requieren cuentas y llaves del propietario.

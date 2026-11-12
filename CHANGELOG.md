# Registro de cambios

## v0.3.0 · 12-nov-2026

### Cambiado (solo visual)
- Nuevo hero de la página principal (`src/components/Hero.tsx`): dos columnas en escritorio y tablet, una en celular. Botón «Suscribirme por $40.000/mes» hacia `/precio`, «Explorar funciones» hacia `#funciones`, enlace a compatibilidad y declaración breve de independencia. A la derecha, un panel con las seis funciones (nombres y resúmenes de `src/lib/content/features.ts`), marcado como ilustración y no como captura de la extensión.
- Paleta verde propia en toda la página (`globals.css`): verde principal `#39A900`, verde oscuro `#237500`, verde claro `#F1F9EB`, bordes `#DCEBD5`, texto `#17251C` y `#526456`. El texto sobre `#39A900` es oscuro porque el blanco no alcanza el contraste AA (≈ 3:1).
- Animaciones de entrada y flotación sutil en el hero, anuladas con `prefers-reduced-motion`.
- Sin cambios en rutas, autenticación, pagos, licencias, base de datos ni contenidos de otras secciones.

## v0.2.0 · 11-nov-2026

### Corregido
- **Toda compra fallaba en Supabase**: `fn_create_order` usa `gen_random_bytes` (pgcrypto), que en Supabase vive en el esquema `extensions`, fuera de su `search_path`. Migración `20261111000100`. No se veía en las pruebas con PostgreSQL simple.
- Confirmación de correo y recuperación de contraseña no funcionaban con las plantillas por defecto de Supabase: se añaden plantillas en español con `token_hash` (`supabase/templates/`) y `/auth/confirmar` acepta además el flujo `?code=`.
- Accesibilidad (axe, WCAG 2.2 AA): contraste del texto secundario y de la etiqueta del inicio, tamaño de los enlaces legales del pie, aviso de prototipo dentro de una región y jerarquía de encabezados en `/funciones`. Sin cambios visuales apreciables.

### Añadido
- Límite de solicitudes compartido entre instancias (tabla `rate_limits`, claves con SHA-256, limpieza diaria). Migración `20261111000300`.
- Eventos `activation_done` y `renewal_done` emitidos por la base de datos. Migración `20261111000200`.
- Configuración de Supabase local (`supabase/config.toml`), scripts `db:start`, `db:stop` y `test:e2e`, y prueba de punta a punta `scripts/e2e-local.mjs` (31 comprobaciones).
- Pruebas SQL del embudo y del límite compartido (`supabase/tests/30_embudo_y_limites.sql`).

### Cambiado
- `zod` 3 → 4.6 (corrige GHSA-mrhx-c7xc-m3w5; `npm audit` sin vulnerabilidades).
- Se elimina el script `lint` (`next lint` ya no existe en Next.js 16).

### Migraciones necesarias
`20261111000100_fix_pgcrypto_search_path.sql`, `20261111000200_analytics_activation_renewal.sql`, `20261111000300_rate_limits.sql`, en orden, después de las de v0.1.0.

## v0.1.1 · 10-nov-2026

### Corregido
- Tipado del cliente *service role* de Supabase (`src/lib/supabase/admin.ts`): con `@supabase/supabase-js` 2.119 el esquema se resolvía como `never` y producía 23 errores de tipos.

### Añadido
- `package-lock.json` con las versiones instaladas.

### Verificado
- `npm run build` superado (primera compilación real), `typecheck` sin errores, 30/30 pruebas, 23/23 bloques SQL, 24/24 del prototipo, páginas públicas servidas por `next start`, bundle sin secretos (A19). Ver `docs/13-pruebas-resultados.md`, anexo.

## v0.1.0 · 10-nov-2026 · Prompt Maestro v2.0

- **Versión anterior:** ninguna en código (existía el brief técnico previo; no se recibieron artefactos de una versión anterior).
- **Requisitos conservados:** todas las rutas y funciones de las secciones 2, 7 y 24 del brief. Las que dependen de terceros conservan su interfaz y su estado documentado.

### Añadido
- Aplicación Next.js 16 con 25 páginas, 12 rutas API y panel administrativo de 8 secciones.
- Dominio puro probado: vigencias mensuales en hora de Colombia, transiciones de pago, compuerta de compra, elegibilidad, tokens de licencia.
- Adaptador Wompi (checkout con integridad, verificación de eventos, consulta de transacción) y proveedor simulado.
- Adaptadores de licencias `pending`, `manual`, `http` (contrato propuesto) y `simulated`; endpoint de validación (opción B).
- Esquema PostgreSQL con 20 tablas, RLS forzado, 18 funciones (más 4 de trigger), auditoría inmutable y semilla.
- Pago manual con evidencia para la transición desde Nequi.
- Prototipo navegable autocontenido con panel de simulación.
- Documentación 00–15, evidencias de pruebas.

### Migraciones necesarias
`20261110000100_schema.sql`, `…0200_rls.sql`, `…0300_functions.sql`, `…0400_seed.sql` (en orden, base vacía).

### Riesgos
Sin compilación de Next.js; sin API de licencias; textos legales en borrador. Ver `docs/14-limitaciones.md`.

### Pruebas ejecutadas
30 de dominio, 23 bloques SQL, 24 del prototipo; tipos sin errores. Ver `docs/13-pruebas-resultados.md`.

### Recomendaciones de implementación
1. `npm install && npm run build` en Claude Code. 2. Proyecto Supabase de staging y migraciones. 3. Sandbox de Wompi. 4. Acordar con el desarrollador de la extensión la opción de licencias. 5. Revisión legal y tributaria.

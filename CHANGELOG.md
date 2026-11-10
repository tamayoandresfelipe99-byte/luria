# Registro de cambios

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

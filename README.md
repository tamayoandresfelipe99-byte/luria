# LURIA · Plataforma web comercial

Sitio comercial y sistema de suscripciones de **LURIA**, extensión de Google Chrome para instructores que imparten formación virtual en un entorno compatible (ZAJUNA).

> **Estado: v0.1.1 · Fase A (prototipo funcional) con base técnica de Fase B.**
> Los cobros reales están **bloqueados por diseño** hasta resolver las dependencias de `docs/12-matriz-dependencias.md`.
> LURIA no tiene relación comercial ni institucional con el SENA.

## Qué hay aquí

| Parte | Estado |
|---|---|
| Sitio público: inicio, funciones, compatibilidad, demostración, precio, instalación, soporte, legal | Implementado |
| Registro, ingreso, recuperación y restablecimiento (Supabase Auth) | Implementado, sin probar contra Supabase real |
| Compra → pasarela → webhook verificado → suscripción → licencia | Implementado; lógica probada; Wompi sin probar en sandbox |
| Cuenta del cliente: estado, vigencia, historial, cancelar/reanudar renovación, consentimiento | Implementado |
| Panel administrativo: vista general, clientes, pagos (+ pago manual con evidencia), licencias, soporte, comercial, reportes, configuración | Implementado |
| Esquema PostgreSQL, funciones transaccionales y RLS | Implementado y **probado en PostgreSQL 16** |
| Adaptador de licencias de la extensión | Contrato propuesto; **no existe API real** (modo `pending`) |
| Mercado Pago / PayU | Comparados y documentados; adaptador no implementado |
| Prototipo navegable autocontenido (`prototype/`) | Publicado y probado con Playwright |

## Requisitos

- Node.js ≥ 20.9 (probado con 22.23)
- Un proyecto de Supabase (o la CLI de Supabase para desarrollo local)
- PostgreSQL 15+ local, solo para `npm run test:sql`

## Ejecución local

```bash
npm install
cp .env.example .env.local        # completa NEXT_PUBLIC_SUPABASE_URL, ANON_KEY y SERVICE_ROLE_KEY
# Aplica las migraciones en orden (Supabase CLI o editor SQL):
#   supabase/migrations/20261110000100_schema.sql … 20261110000400_seed.sql
npm run dev                        # http://localhost:3000
```

Con `PAYMENT_PROVIDER=mock` y `LICENSE_ADAPTER=simulated` puedes recorrer el flujo completo. El simulador de pagos (`/compra/simulador`) firma eventos con el mismo formato de Wompi. En producción responde 404 y la aplicación **no arranca** si detecta piezas simuladas.

Para dar el rol de administrador a tu usuario (editor SQL de Supabase):

```sql
insert into public.staff_roles (user_id, role) select id, 'admin' from auth.users where email = 'tu-correo@ejemplo.com';
```

## Pruebas

```bash
npm test            # 30 pruebas de dominio, pagos, licencias y contenido (A01–A22, F01–F06)
npm run test:sql    # migraciones + 23 bloques de pruebas sobre PostgreSQL temporal (RLS, idempotencia, fechas)
npm run typecheck   # TypeScript estricto
node scripts/check-prototype.mjs   # 24 comprobaciones del prototipo (requiere Playwright)
```

Resultados observados, entorno y fecha: `docs/13-pruebas-resultados.md`.

## Estructura

```
src/
  app/                    Rutas (App Router). Páginas públicas, auth, compra, cuenta, admin y api/
  components/             Componentes reutilizables (encabezado, tarjetas, avisos, WhatsApp, consentimiento)
  lib/
    domain/               Reglas puras: fechas (America/Bogota), dinero, estados, acceso, elegibilidad
    payments/             Interfaz de pasarela, adaptador Wompi, proveedor simulado
    licensing/            Contrato de licencias, adaptadores (pending/manual/http/simulated), tokens Ed25519
    services/             Procesador de webhooks, vista del cliente, fábrica de servicios
    supabase/             Clientes (servidor, navegador, service role) y repositorio sobre funciones SQL
    content/              Funciones, FAQ, textos legales (borrador), textos del sitio
    security/, analytics/ CSRF por origen, límites de solicitudes, taxonomía de eventos
  proxy.ts                Sesión, protección de rutas privadas y atribución
supabase/migrations/      Esquema, RLS, funciones transaccionales y semilla
supabase/tests/           Pruebas SQL
tests/                    Pruebas node:test
prototype/                Plantilla y script del prototipo navegable
docs/                     Documentación (índice en docs/00-indice-entregables.md)
```

## Documentación

Empieza por `docs/00-indice-entregables.md`, que relaciona los 30 entregables del brief con su archivo.

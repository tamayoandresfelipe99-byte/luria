# 14. Errores conocidos y limitaciones

| # | Limitación | Impacto | Próximo paso |
|---|---|---|---|
| 1 | ~~La app no se había compilado ni probado contra Supabase~~ **Resuelto**: build superado y flujos completos probados contra Supabase local (`npm run test:e2e`, 31/31) | Falta un proyecto Supabase alojado (correo real con SMTP propio) | Proyecto de staging |
| 2 | `proxy.ts` usa la convención de Next.js 16 | Con Next ≤15 se ignora (protección de rutas privadas sin redirección temprana; el layout y las APIs igual validan) | Mantener `next@^16`, o renombrar a `middleware.ts` y exportar `middleware` |
| 3 | No existe API de licencias de la extensión | Cada pago aprobado queda en «activación pendiente» | `04-contrato-licencias.md` |
| 4 | Adaptadores de Mercado Pago y PayU no implementados | Solo Wompi o el simulador | Implementar `PaymentProvider` si se elige otro proveedor |
| 5 | ~~Límite de solicitudes en memoria por instancia~~ **Resuelto en v0.2.0**: tabla `rate_limits` compartida; memoria solo como respaldo si la base falla | — | — |
| 6 | Proveedor simulado en memoria | Solo funciona en `next dev` | Solo para desarrollo, por diseño |
| 7 | Reembolso de una renovación revoca toda la suscripción | Puede cortar un período anterior aún pagado | Decisión de negocio pendiente (`05-suscripciones-renovacion.md` §5.6) |
| 8 | ~~Eventos `activation_done` y `renewal_done` sin emisor~~ **Resuelto en v0.2.0**: los emite la base de datos | — | — |
| 9 | No hay envío propio de correos (avisos de vencimiento, activación) | Avisos solo en la cuenta y el panel | Fase C: n8n o servicio transaccional (`15-crm-automatizaciones.md`) |
| 10 | Accesibilidad: **axe sin violaciones** (WCAG 2.0–2.2 A/AA, 12 páginas públicas, escritorio y móvil, v0.2.0). Falta prueba con lector de pantalla | Objetivo WCAG 2.2 AA sin certificar | Auditoría manual con NVDA/VoiceOver |
| 11 | Demostraciones sin material autorizado | La página explica en texto | Videos o capturas sin datos de aprendices |
| 12 | Textos legales en borrador | Cobros reales bloqueados | `11-legal-pendiente.md` |
| 13 | Estados de licencia `failed` definidos pero no usados | — | Usarlos cuando exista API real |
| 14 | El prototipo reimplementa en JavaScript algunas reglas del dominio | Puede divergir de la app si se cambia una sin la otra | Las reglas autoritativas son las de `src/lib/domain` y SQL; el prototipo es demostrativo |
| 15 | Pagos simulados no emiten `payment_verified` (solo el webhook real lo emite) | En desarrollo el embudo no muestra ese paso | Sin impacto en producción |
| 16 | Supabase limita los correos de Auth (2 por hora con el SMTP incluido) | En producción, registros y recuperaciones fallarían con tráfico mínimo | SMTP propio antes de abrir el registro (`08-despliegue.md` §1.6) |

# 14. Errores conocidos y limitaciones

| # | Limitación | Impacto | Próximo paso |
|---|---|---|---|
| 1 | ~~La app Next.js no se había compilado~~ **Resuelto**: `npm run build` superado con Next.js 16.4.6 (ver `13-pruebas-resultados.md`, anexo) | Los flujos con sesión no se han probado contra Supabase real | Proyecto Supabase de staging |
| 2 | `proxy.ts` usa la convención de Next.js 16 | Con Next ≤15 se ignora (protección de rutas privadas sin redirección temprana; el layout y las APIs igual validan) | Mantener `next@^16`, o renombrar a `middleware.ts` y exportar `middleware` |
| 3 | No existe API de licencias de la extensión | Cada pago aprobado queda en «activación pendiente» | `04-contrato-licencias.md` |
| 4 | Adaptadores de Mercado Pago y PayU no implementados | Solo Wompi o el simulador | Implementar `PaymentProvider` si se elige otro proveedor |
| 5 | Límite de solicitudes en memoria por instancia | En hosting con varias instancias el límite es por instancia | Tabla en Postgres o Redis gestionado |
| 6 | Proveedor simulado en memoria | Solo funciona en `next dev` | Solo para desarrollo, por diseño |
| 7 | Reembolso de una renovación revoca toda la suscripción | Puede cortar un período anterior aún pagado | Decisión de negocio pendiente (`05-suscripciones-renovacion.md` §5.6) |
| 8 | Eventos analíticos `activation_done` y `renewal_done` sin emisor | Embudo incompleto en esos pasos | Emitirlos desde `fn_mark_license_active` y la renovación |
| 9 | No hay envío propio de correos (avisos de vencimiento, activación) | Avisos solo en la cuenta y el panel | Fase C: n8n o servicio transaccional (`15-crm-automatizaciones.md`) |
| 10 | Accesibilidad no auditada con lector de pantalla | Objetivo WCAG 2.2 AA sin certificar | Auditoría con NVDA/VoiceOver y axe |
| 11 | Demostraciones sin material autorizado | La página explica en texto | Videos o capturas sin datos de aprendices |
| 12 | Textos legales en borrador | Cobros reales bloqueados | `11-legal-pendiente.md` |
| 13 | Estados de licencia `failed` definidos pero no usados | — | Usarlos cuando exista API real |
| 14 | El prototipo reimplementa en JavaScript algunas reglas del dominio | Puede divergir de la app si se cambia una sin la otra | Las reglas autoritativas son las de `src/lib/domain` y SQL; el prototipo es demostrativo |

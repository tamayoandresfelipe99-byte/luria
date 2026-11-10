# 15. CRM y automatizaciones (Fase C)

Principios: el CRM **no** decide si un pago ocurrió; ninguna automatización concede acceso; no se duplican los comprobantes que ya envía la pasarela; las promociones exigen consentimiento vigente.

## Eventos de negocio disponibles

| Evento | Origen en la base | Uso sugerido |
|---|---|---|
| Registro | `profiles` insert | Bienvenida operativa |
| Compra iniciada | `orders` (pending_payment) | Recuperación de pago a las 24 h, **solo con consentimiento de marketing** |
| Pago verificado | `audit_log` action `payment.approved` | Confirmación + instrucciones de instalación |
| Activación | `audit_log` `license.activated` | «Tu licencia está activa» |
| Próximo vencimiento | `subscriptions.current_period_end` a 5 días | Recordatorio de renovación (operativo) |
| Pago fallido | `payments` declined/error | Aviso con enlace para reintentar |
| Cancelación | `audit_log` `subscription.cancel_at_period_end` | Encuesta de retroalimentación (consentida) |
| Solicitud de soporte | `support_requests` insert | Notificación al equipo |

## Integración recomendada

1. **Supabase Database Webhooks** (o una tabla `outbox` leída por cron) → **n8n** (autoalojado o en la nube) → canal (correo transaccional, WhatsApp Business API con plantillas aprobadas, hoja o CRM).
2. Firmar las llamadas a n8n con HMAC y enviar solo identificadores. n8n consulta los datos mínimos con una llave de solo lectura limitada.
3. Antes de cualquier mensaje promocional, comprobar el último `consents.marketing = true`.
4. CRM: con unos 30 a 300 clientes basta una hoja compartida o un CRM sencillo (HubSpot gratuito, Pipedrive). No se construye un CRM propio.

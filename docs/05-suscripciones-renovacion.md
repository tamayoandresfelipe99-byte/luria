# 5. Suscripciones y procedimiento de renovación

## 5.1 Regla de vigencia (zona horaria America/Bogota, UTC−5 sin horario de verano)

- **Inicio:** el momento en que la pasarela confirma el pago (`finalized_at`), nunca la hora del navegador.
- **Día ancla:** el día del mes, en hora de Colombia, del inicio de la primera vigencia.
- **Vencimiento:** 23:59:59.999 (hora de Colombia) del mismo número de día del mes siguiente.
- **Fin de mes:** si ese día no existe, vence el último día del mes, y el ancla se conserva. Ejemplo: 31 ene → 28 feb (29 en bisiesto) → 31 mar.
- **Renovación antes de vencer:** el nuevo período empieza al terminar el actual. No se pierden ni se regalan días.
- **Renovación después de vencer:** empieza un período nuevo con ancla nueva. El tiempo sin pagar no se cobra ni se concede.
- **Días de gracia:** 0. Al vencer, el acceso termina.

> Pendiente de validación jurídica: se tomó el criterio de plazos de meses (mismo número de día). Si el abogado prefiere vencer a la misma hora del inicio, solo cambia `endOfBogotaDay` en `src/lib/domain/time.ts` y `fn_end_of_bogota_day` en SQL.

Implementada dos veces con las mismas reglas y probada en ambas: TS (`computeNextPeriod`) y SQL (`fn_next_period`), casos A21.

## 5.2 Estados que ve el cliente

| Estado | Cuándo |
|---|---|
| Sin suscripción | Nunca pagó |
| Pago pendiente / no aprobado | Último pago pendiente o rechazado |
| Pago recibido, activación pendiente | Pago verificado, licencia no confirmada |
| Activación con incidencia | El servicio de licencias falló; hay una tarea abierta |
| Activa | Licencia activa y vigente |
| Próxima a vencer | Faltan 5 días o menos |
| Activa · no se renovará | Canceló los cobros futuros; conserva el acceso hasta el vencimiento |
| Vencida | Pasó el vencimiento |
| Revocada | Reembolso o reversión confirmados |

## 5.3 Procedimiento de renovación MANUAL (modo inicial)

1. **Aviso:** el panel muestra «Renovaciones próximas (5 días)». El cliente ve «Próxima a vencer» en su cuenta. Si tiene consentimiento, se puede enviar un aviso operativo por correo o WhatsApp (Fase C, `15-crm-automatizaciones.md`).
2. **Pago:** el cliente entra a «Mi cuenta» → «Renovar un mes» → `/compra`. Se crea un pedido marcado `is_renewal`.
3. **Confirmación:** al llegar el evento verificado, `fn_apply_payment` extiende `current_period_end` desde el vencimiento actual.
4. **Licencia:** `grant` con el nuevo `valid_until` (extensión de la licencia existente).
5. **Sin pago:** al vencer, el cron diario marca la suscripción `expired` y revoca o expira la licencia.

Protecciones: un único pedido pendiente por cliente; no se permite pagar un segundo período si ya hay uno futuro sin iniciar (A13); un evento duplicado no crea otra vigencia.

## 5.4 Renovación AUTOMÁTICA (Fase C, diseño)

- Requiere autorización expresa y separada del cliente, guardada en `consents` con versión del texto.
- Con Wompi: fuente de pago tokenizada (tarjeta o Nequi). Un cron crea el pedido y cobra el día del vencimiento, con hasta 3 reintentos en 3 días sin extender el acceso mientras tanto. Sin éxito, la suscripción vence.
- Con Mercado Pago: `/preapproval` con reintentos propios. Sus webhooks crean el pago del período.
- `subscriptions.renewal_mode` ya existe (`manual` | `automatic`). La cancelación de cobros futuros (`fn_cancel_renewal`) aplica igual.

## 5.5 Cancelación de cobros futuros

Desde «Mi cuenta», con confirmación. Marca `cancel_at_period_end` y **no** toca la vigencia pagada (A12). Se puede reanudar antes del vencimiento.

## 5.6 Reembolsos y reversiones

Llegan como eventos verificados (`refunded` / `reversed`). La vigencia asociada se marca reembolsada, la suscripción pasa a `revoked`, la comisión se anula y la licencia se revoca, o se crea una tarea de revocación. Decisión de diseño pendiente de validar: si se reembolsa una renovación mientras un período anterior sigue vigente, hoy se revoca todo y el administrador decide la restitución.

# 9. Manual del administrador comercial

Panel: `https://DOMINIO/admin`. Requiere una cuenta con rol (`staff_roles`). Lo que cada rol ve depende de los permisos (`02-modelo-datos.md` §2.4).

## 1. Roles

| Rol | Puede | No puede |
|---|---|---|
| Comercial | Ver clientes, pedidos, pagos, atribución, comisiones y reportes | Ver eventos técnicos, auditoría, licencias o soporte; registrar pagos; cambiar configuración |
| Soporte | Ver clientes, licencias y tareas; atender solicitudes | Ver pagos y comisiones; registrar pagos |
| Administrador | Todo, incluido el pago manual con evidencia, reintentos de activación y configuración | Marcar pagos como aprobados sin evidencia (el sistema no lo permite) |

Asignar roles: solo un administrador, por SQL. Retirar un rol: `delete from staff_roles where user_id = … and role = …`.

## 2. Vista general (indicadores)

Usuarios registrados, suscriptores activos, ventas verificadas, ingresos verificados (sin discrepancias ni reembolsos), renovaciones próximas (5 días), pedidos pendientes, activaciones pendientes, clientes vencidos y solicitudes abiertas. Todo sale de la base de datos del entorno: en producción no hay cifras ficticias.

## 3. Clientes

Búsqueda por nombre o correo. La ficha muestra cuenta, canal de adquisición, suscripción, historial de pedidos y pagos (con discrepancias marcadas), incidencias y consentimientos con fecha.

**Antes de escribir a un cliente con fines comerciales**, revisa que su último consentimiento de «marketing» esté otorgado. Los avisos operativos (vencimiento, activación) no requieren ese consentimiento, pero no deben llevar publicidad.

## 4. Gestión comercial

- **Fuente de adquisición:** se registra al crear la cuenta desde `?utm_source=` o `?ref=CODIGO`. Ejemplo de enlace para WhatsApp: `https://DOMINIO/?utm_source=whatsapp`.
- **Referidos:** se crean en la tabla `referrers` con `authorized = true` y un `commission_pct` acordado por escrito. Enlace del referido: `https://DOMINIO/?ref=CODIGO`.
- **Comisiones:** se generan solas con cada pago verificado de un cliente referido (`atribuible`) y se anulan si el pago se reembolsa. Al pagar la comisión al referido, actualiza su estado a `recibida` con la fecha.

## 5. Soporte y WhatsApp

- El número se configura en `NEXT_PUBLIC_SUPPORT_WHATSAPP`. Si está vacío, los botones muestran «por configurar».
- Los botones abren mensajes predefinidos por tema, sin datos personales.
- Solicitudes del formulario: `/admin/soporte`. Cambia el estado (abierta → en proceso → esperando cliente → resuelta → cerrada).
- **Nunca** pidas al cliente contraseñas institucionales, capturas con datos de aprendices ni evidencias académicas. Si las envía, no las reenvíes ni las guardes; pídele que las borre del chat.
- Un comprobante enviado por WhatsApp **no** activa el servicio. Ver `10-manual-pagos-activaciones.md`.

## 6. Reportes

Ventas, renovaciones, ingresos y reembolsos por mes (hora de Colombia); embudo de conversión anónimo, solo de visitantes que aceptaron la medición; cancelaciones de renovación.

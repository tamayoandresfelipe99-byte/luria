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

Arriba, destacado: **«Clientes con pago confirmado y acceso pendiente»**. Al hacer clic se abre el filtro «Pagaron, pero no tienen acceso» de *Pagos y accesos*; mientras el número sea mayor que cero, hay clientes que pagaron y siguen esperando su enlace.

Después: usuarios registrados, suscriptores activos, ventas verificadas, ingresos verificados (sin discrepancias ni reembolsos), próximos a vencer (7 días), pedidos pendientes, activaciones pendientes, clientes vencidos y solicitudes abiertas. Todo sale de la base de datos del entorno: en producción no hay cifras ficticias.

## 2b. Pagos y accesos (`/admin/accesos`)

El **estado de pago** y el **estado de acceso** son independientes:

| Estado de pago (lo calcula el sistema) | Significado |
|---|---|
| Pendiente de pago | Registrado, sin pago vigente |
| Pago en verificación | Pago en curso en la pasarela o con discrepancia de importe |
| Al día | Suscripción vigente por más de 7 días |
| Próximo a vencer | Vence en 7 días o menos |
| Vencido | La vigencia terminó |

| Estado de acceso (lo gestiona un administrador) | Significado |
|---|---|
| Pendiente de asignación | Aún no hay enlace |
| Enlace guardado | Hay enlace, pero el cliente **no lo ve** |
| Acceso habilitado | El cliente ve el botón «Acceder a LURIA» |
| Acceso suspendido | Pasa solo al vencer la suscripción |
| Acceso revocado | Lo revocó un administrador o hubo un reembolso o reversión |

**Habilitar el acceso de un cliente que pagó:**
1. Filtro **«Pagaron, pero no tienen acceso»**.
2. Pega el enlace en la columna *Enlace* (debe empezar por `https://`) y presiona **Guardar enlace**. El cliente todavía no lo ve.
3. Presiona **Habilitar acceso**. El servidor comprueba que eres administrador y que la suscripción está vigente.
4. El cliente recibe una notificación en su cuenta y le aparece el botón **«Acceder a LURIA»**.

**Otras acciones:**
- **Sustituir el enlace:** pega el nuevo y presiona *Guardar enlace*. Si ya estaba habilitado, sigue habilitado con el enlace nuevo y el cliente recibe un aviso.
- **Revocar:** pide un motivo. También se revoca la licencia en el sistema de la extensión si estaba activa. Para volver a dar acceso: guarda de nuevo el enlace y habilita.
- **Al vencer la suscripción**, el acceso se suspende solo. Cuando el cliente renueva, aparece de nuevo en «Pagaron, pero no tienen acceso» y debes habilitarlo otra vez.

**Permisos:** solo los administradores guardan, habilitan y revocan. Soporte consulta los estados y los enlaces; comercial consulta los estados, pero no los enlaces. Cada acción queda en la auditoría con quién la hizo y cuándo; de la URL solo se guardan el dominio y un resumen, no la URL completa.

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

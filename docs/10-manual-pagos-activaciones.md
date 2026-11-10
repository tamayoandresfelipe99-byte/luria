# 10. Manual de pagos y activaciones

## 1. Pago por la pasarela (camino normal)

No requiere intervención. El estado avanza solo cuando llega un evento firmado y la consulta a Wompi lo confirma. Si un cliente dice «ya pagué»:

1. Busca su pedido en `/admin/clientes` → ficha → historial.
2. Si el pago aparece **pendiente**, espera la confirmación de la pasarela. No lo marques a mano.
3. Si no aparece, revisa el panel de Wompi por la referencia `LUR-…`. Si allí está aprobado, reenvía el evento desde Wompi: el sistema es idempotente.
4. Si aparece en **Eventos que requieren revisión** (`/admin/pagos`), lee la nota:
   - *Importe o moneda no coinciden:* posible manipulación. No actives nada; contacta al cliente y gestiona el reembolso por la pasarela.
   - *Transición contradictoria:* la pasarela reportó estados finales distintos. Consulta en el panel de Wompi el estado real y escala a soporte técnico.
   - *Pedido inexistente:* la referencia no corresponde a ningún pedido de este entorno. Comprueba que el webhook de sandbox no apunte a producción.

## 2. Pago manual (transición desde Nequi)

Solo para pagos recibidos fuera de la pasarela mientras dure la transición. **Un comprobante enviado por chat no prueba el ingreso.**

1. El cliente crea su cuenta e inicia la compra en la web, para que exista un pedido `LUR-…` con el precio correcto.
2. Verifica el ingreso en la app o el extracto **del comercio**: fecha, hora, valor exacto y referencia.
3. En `/admin/pagos` → «Registrar pago manual con evidencia» indica:
   - la referencia del pedido;
   - el medio;
   - la referencia de la transacción en Nequi;
   - el valor recibido;
   - la fecha y hora;
   - una nota de cómo lo verificaste.
4. El sistema:
   - exige el rol admin;
   - rechaza valores distintos al pedido (quedan como discrepancia);
   - impide reutilizar la misma referencia de Nequi en otro pedido;
   - registra la acción en la auditoría con tu usuario;
   - pide la activación de la licencia.

No hay forma de «aprobar» un pago sin estos datos. Este flujo debe desaparecer cuando la pasarela esté en producción.

## 3. Activaciones

`/admin/licencias` muestra las tareas abiertas con el código de error, los intentos y el vencimiento según el SLA.

| Código | Significado | Acción |
|---|---|---|
| `LICENSE_ADAPTER_PENDING` | No hay integración con la extensión | Esperar la integración, o activación manual si está autorizada |
| `MANUAL_ACTION_REQUIRED` | Modo manual | Habilitar en el sistema de la extensión y registrar el ID externo y la evidencia |
| `UPSTREAM_ERROR` / `TIMEOUT` | El servicio de licencias falló | «Reintentar»; si persiste, escalar al equipo de la extensión |
| `UPSTREAM_REJECTED` | El servicio rechazó la solicitud | Revisar los datos del cliente con el equipo de la extensión |

Si se vence el SLA sin activación, contacta al cliente y aplica el procedimiento definido antes de producción (por ejemplo, reembolso o ampliación del período **acordada y registrada**, nunca días gratis informales).

## 4. Reembolsos y reversiones

1. El reembolso se ejecuta **en la pasarela**, no en la web.
2. Al llegar el evento, la web revoca la suscripción y la licencia y anula la comisión. Si la revocación técnica falla, queda una tarea `revocation`.
3. Las reversiones (contracargos, Ley 1480 art. 51) siguen el mismo camino.

## 5. Vencimientos

El cron diario expira las suscripciones vencidas y llama a `revoke` en el servicio de licencias. Aun sin cron, la licencia tiene `valid_until` y la extensión debe dejar de funcionar sola (A11, A22).

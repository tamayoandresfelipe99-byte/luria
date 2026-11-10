# 4. Contrato de integración de licencias (propuesta)

> **No existe hoy una API de licencias de la extensión.** Este documento es la propuesta para el desarrollador de la extensión. Mientras no se acuerde, la web opera con `LICENSE_ADAPTER=pending`: cada pago aprobado genera una tarea auditable y el cliente ve «Pago recibido, activación pendiente».

## 4.1 Información que se solicita al desarrollador de la extensión

| Tema | Pregunta |
|---|---|
| Instalación | ¿Chrome Web Store (pública o no listada) o instalación empresarial? ¿Cuál es el enlace real? |
| Identificador de usuario | ¿Cómo sabe la extensión quién es el usuario? Propuesta: inicio de sesión con la cuenta de la web, o un código de activación ligado a `external_ref` |
| Mecanismo de licencia | ¿Existe hoy alguna verificación? ¿Dónde se guarda el estado? |
| Habilitación y revocación | ¿Cómo se habilita y revoca hoy? ¿Tiene efecto inmediato? |
| Consulta de estado | ¿Se puede consultar por API? |
| Expiración | ¿La extensión deja de funcionar sola al vencer, o depende de una revocación? |
| Sin conexión | ¿Cuánto tiempo funciona sin consultar al servidor? |
| Permisos | Lista de permisos del manifest (necesaria para la página de compatibilidad y privacidad) |
| Documentación | Versión, entornos verificados y procedimiento de pruebas |

Nota: los pagos y el licenciamiento de la Chrome Web Store están obsoletos. Google cerró los pagos y anunció el fin de su API de licencias, así que el control debe vivir en un servidor propio.

## 4.2 Opción A · API de la extensión (adaptador `http`)

La web llama al servicio de licencias de la extensión. Implementado en `src/lib/licensing/adapters.ts → createHttpAdapter`.

**Autenticación:** `x-luria-timestamp` (epoch s) y `x-luria-signature = HMAC-SHA256(secreto, "{ts}.{MÉTODO}.{ruta}.{cuerpo}")`. Se rechazan relojes desfasados más de 5 min. Además, `Idempotency-Key` en las operaciones de escritura.

| Operación | Método y ruta | Cuerpo | Respuesta 200 |
|---|---|---|---|
| Habilitar | `POST /v1/licenses/grant` | `{ external_user_ref, subscription_id, valid_until }` | `{ license_id, status: "active", valid_until }` |
| Revocar | `POST /v1/licenses/revoke` | `{ license_id, reason: refund\|chargeback\|expired\|admin\|fraud }` | `{ license_id, status: "revoked", valid_until }` |
| Consultar | `GET /v1/licenses/{license_id}` | — | `{ license_id, status, valid_until }` |

**Requisitos:**

- `grant` es idempotente por `Idempotency-Key`. Si ya existe licencia para el usuario, extiende `valid_until`.
- La extensión **no permite uso** si `now > valid_until`, aunque no reciba una revocación.
- 5xx y 429 se reintentan; 4xx se tratan como rechazo y generan una tarea.

## 4.3 Opción B · La web como autoridad (endpoint ya implementado, inactivo)

`POST /api/licencia/validar` con `Authorization: Bearer <token de sesión de Supabase>`. Responde un token firmado con **Ed25519** cuyo `exp = min(valid_until, ahora + TTL)`. Así nunca se extiende más allá de lo pagado (A22).

La extensión incrusta la llave pública y verifica localmente. Hay una implementación de referencia en `src/lib/licensing/token.ts → verifyLicenseToken`. Sin conexión, el acceso termina cuando expira el token.

Ventaja: no requiere un backend propio en la extensión. Requiere que la extensión implemente el inicio de sesión y la verificación. Para activarla: `npm run keys:license` y `LICENSE_TOKEN_PRIVATE_KEY` en el servidor.

## 4.4 Opción C · Activación manual auditada (adaptador `manual`)

Solo se permite si existe un mecanismo **real** que controle la vigencia y permita revocar (`LICENSE_MANUAL_REVOCATION_CONFIRMED=true`). La persona de operaciones habilita en el sistema de la extensión y registra en `/admin/licencias` el identificador externo y la evidencia. Todo queda en `audit_log`.

**No aceptable:** un enlace de instalación secreto y reutilizable como «licencia». Cualquiera que lo reciba tendría acceso indefinido.

## 4.5 Fallo de activación

Pago aprobado y licencia fallida: suscripción `pending_activation` o `activation_failed`, tarea en `activation_tasks` con `due_at = ahora + ACTIVATION_SLA`, mensaje al cliente, reintento desde el panel. El SLA y el procedimiento de resolución (incluido el reembolso si se incumple) deben definirse antes de producción.

# 3. Pasarelas de pago en Colombia

Investigación del 10-nov-2026. **Las tarifas deben confirmarse por escrito con cada proveedor al contratar**: cambian y dependen del tipo de comercio.

## 3.1 Comparación

| Criterio | Wompi (Grupo Cibest / Bancolombia) | Mercado Pago | PayU (Rapyd) |
|---|---|---|---|
| Tarifa publicada (online) | 2,65 % + $700 + IVA por transacción aprobada | 2,99 % + IVA (dinero en 7 días) o 2,79 % + IVA (14 días), según su página de link de pago | 3,29 % + $300 + IVA; mínimos para PSE y Nequi |
| Costo de una venta de $40.000 | ≈ $2.094 | ≈ $1.423 (7 días) | ≈ $1.923 + retenciones en tarjeta crédito |
| Nequi | Sí, nativo | No como medio directo publicado | Sí |
| PSE | Sí | Sí | Sí |
| Recurrencia | Fuentes de pago tokenizadas (tarjeta y Nequi) y cobros sin presencia del cliente. **No hay motor de suscripciones**: los cobros se programan desde nuestro servidor | Motor de suscripciones nativo (`/preapproval`) con reintentos | Módulo de pagos recurrentes que requiere activación por parte de PayU |
| Verificación de eventos | Checksum SHA-256 de propiedades + timestamp + secreto; encabezado `X-Event-Checksum`; 3 reintentos en 24 h | Webhooks con validación de firma | Confirmación con firma |
| Integración en este código | **Implementada** (`src/lib/payments/wompi.ts`) | No implementada | No implementada |

Fuentes: documentación de eventos y fuentes de pago de Wompi, página de tarifas de Bancolombia/Wompi, página de tarifas estándar de PayU Colombia, páginas de link de pago y suscripciones de Mercado Pago Colombia.

## 3.2 Recomendación

**Wompi para el MVP con renovación manual.**

1. Los clientes actuales pagan por Nequi, que Wompi soporta de forma nativa. Es la transición con menos fricción.
2. Admite PSE, tarjetas y Bancolombia en un mismo checkout.
3. Para la Fase C permite renovación automática con fuentes de pago de tarjeta o Nequi, con autorización del cliente. Nuestro servidor programaría el cobro y los reintentos.

**Cuándo preferir Mercado Pago:** si la renovación automática es prioritaria desde el inicio y el costo por transacción pesa más que Nequi. Tiene la tarifa publicada más baja y un motor de suscripciones con reintentos propios. Su contra: no ofrece Nequi como medio directo. Agregar su adaptador implica implementar `PaymentProvider` (checkout, verificación de webhook y consulta de transacción) sin tocar el resto del sistema.

`PAYMENT_PROVIDER` sigue como **decisión pendiente del propietario**.

## 3.3 Lo que no se asume

- Admitir PSE **no** implica débito automático por PSE: PSE requiere que el cliente autorice cada pago.
- Un comprobante de Nequi enviado por WhatsApp no prueba que el dinero ingresó. Ver el pago manual con evidencia en `10-manual-pagos-activaciones.md`.
- La URL de retorno de la pasarela no activa nada.

## 3.4 Adaptador Wompi implementado

- **Checkout web** con firma de integridad `SHA256(referencia + centavos + COP + secreto_integridad)` y redirección a `/pago/resultado?referencia=…`.
- **Webhook** en `/api/pagos/webhook/wompi`. Se configura en el panel de Wompi, con una URL distinta por entorno.
  1. Calcula el checksum con las propiedades indicadas en `signature.properties`, sin una lista fija, y compara en tiempo constante, sin distinguir mayúsculas.
  2. Rechaza eventos con más de 48 h de antigüedad.
  3. Deduplica el evento.
  4. Consulta `GET /v1/transactions/{id}`.
  5. Aplica el pago.
- **Respuestas HTTP**:
  - 200 para lo procesado, ignorado o en revisión, para que Wompi no reintente.
  - 401 para firmas inválidas.
  - 503 si la consulta a Wompi falla, para que Wompi reintente.

Pendiente de probar contra el sandbox real de Wompi: requiere llaves de prueba. Ver `12-matriz-dependencias.md`.

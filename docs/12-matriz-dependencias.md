# 12. Matriz de dependencias

Estado al 10-nov-2026. «Bloquea cobros» significa que `realChargeBlockers()` impide cobrar dinero real mientras falte. La misma lista se ve en vivo en `/admin/configuracion`.

| Clave | Estado | Responsable | Bloquea cobros | Qué se necesita | Efecto mientras falta |
|---|---|---|---|---|---|
| `BRAND_NAME` | ✅ LURIA | — | — | — | — |
| `BRAND_ASSETS` | ⏳ Pendiente | Propietario | No | Logotipo, colores y tipografía oficiales | Logotipo tipográfico provisional |
| `VERIFIED_FEATURES` | ⏳ 6 declaradas | Equipo de la extensión | No | Evidencia y versión por módulo | Cada función muestra «Declarada por el fabricante» |
| `SUPPORTED_ENVIRONMENTS` | ⏳ Pendiente | Equipo de la extensión | **Sí** | Plataforma, dominio, versión y navegador probados, con evidencia y fecha | La compatibilidad responde «en verificación» y la compra queda bloqueada |
| `SELLER_IDENTITY` | ⏳ Pendiente | Propietario | **Sí** | Razón social o nombre, NIT, domicilio, contacto | Aviso de pendiente en precio, compra y pie |
| `SUPPORT_WHATSAPP` | ⏳ Pendiente | Propietario | No | Número de atención | Botones de WhatsApp con «por configurar» |
| `EXTENSION_INSTALL_URL` | ⏳ Pendiente | Equipo de la extensión | **Sí** | Enlace real (Chrome Web Store u otro) | Instalación sin enlace |
| `LICENSE_ADAPTER` | ⏳ `pending` | Equipo de la extensión | **Sí** | Opción A, B o C de `04-contrato-licencias.md` | Cada pago genera una tarea de activación |
| `PAYMENT_PROVIDER` | ⏳ Por elegir (Wompi implementado) | Propietario | **Sí** | Decisión y cuenta de comercio con credenciales | Solo simulador en desarrollo |
| `RENEWAL_MODE` | ⏳ Por acordar | Propietario | **Sí** | Manual (recomendado al inicio) o automática | Textos muestran «por definir» |
| `PRICE_TAX_TREATMENT` | ⏳ Pendiente | Contador | **Sí** | ¿$40.000 con o sin impuestos? | Aviso «tratamiento tributario pendiente» |
| `LEGAL_TEXTS` | ⏳ Borradores | Abogado | **Sí** | Revisión de `11-legal-pendiente.md` | Banner «borrador» en páginas legales |
| `ACTIVATION_SLA` | ⏳ Por definir | Propietario + extensión | **Sí** | Horas máximas de activación y procedimiento si se incumple | Tareas con SLA de 24 h por defecto |
| Llaves Supabase | ⏳ Por crear | Propietario o desarrollador | — (necesarias para ejecutar) | Proyectos staging y prod | La app no arranca sin ellas |
| Dominio | ⏳ Por definir | Propietario | — | Dominio y DNS | — |

## Dependencias técnicas (paquetes)

`next` 16, `react` / `react-dom` 19, `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `server-only`. Desarrollo: `typescript`, `tsx`, `@types/*`. Las versiones están en `package.json` con rangos `^`. Fijarlas con `package-lock.json` en el primer `npm install` y comprobar con `npm run build`. Fijadas en `package-lock.json`; `next build` superado (ver `13-pruebas-resultados.md`, anexo).

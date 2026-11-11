# 7. Analítica, SEO y consentimiento

## 7.1 Consentimiento

| Finalidad | Cómo se obtiene | Dónde se guarda | Efecto |
|---|---|---|---|
| Términos | Casilla obligatoria al registrarse y al comprar | `consents` (versión del aviso) | Necesario para la cuenta y la compra |
| Privacidad | Casilla obligatoria al registrarse | `consents` | Necesario para la cuenta |
| Comunicaciones comerciales | Casilla **opcional** al registrarse; editable en «Mi cuenta» | `consents` (historial; manda el último) | Si no se otorga o se retira, no se envían promociones (A02, A18) |
| Analítica no esencial | Banner: «Aceptar medición» o «Solo esenciales» | Cookie `luria_analytics` (180 días) | Sin aceptación no se registra ningún evento |

Los mensajes operativos (confirmación de compra, activación, vencimiento) no son publicidad. La pasarela ya envía su comprobante; no se duplica.

## 7.2 Analítica

Primera parte y sin terceros: tabla `analytics_events`, alimentada por `/api/analitica`.

| Evento | Origen |
|---|---|
| page_view, pricing_view, compat_check, signup_start, signup_done, checkout_start | Navegador (solo con consentimiento) |
| payment_verified (webhook), cancellation (cuenta) | Solo servidor (el navegador no puede emitirlos) |
| activation_done, renewal_done | Emitidos por la base de datos (migración `20261111000200`): `activation_done` en la primera activación de la licencia de una suscripción; `renewal_done` en cada vigencia pagada después de la primera. Sin datos personales |

- Identificador anónimo aleatorio (UUID en `localStorage`), sin correo, nombre, teléfono ni referencia de pedido.
- `path` sin parámetros; la base rechaza rutas con `@`.
- Separada de los registros financieros: los reportes de ventas salen de `payments`, nunca de la analítica.
- Fuente de adquisición: `?utm_source=` o `?ref=CODIGO` → cookie `luria_src` → `attribution` al registrarse.

Para agregar Google Analytics u otra herramienta, debe cargarse solo con la cookie `luria_analytics=granted` y ajustar la CSP.

## 7.3 SEO

- Metadatos por página (título con plantilla «%s · LURIA», descripción), `lang="es-CO"`, Open Graph `es_CO`.
- `sitemap.xml` con solo páginas públicas y legales.
- `robots.txt`: en producción excluye `/admin`, `/cuenta`, `/compra`, `/pago`, `/api` y las rutas de autenticación; en otros entornos bloquea todo.
- `X-Robots-Tag: noindex` en áreas privadas.
- HTML semántico (encabezados jerárquicos, `nav`, `main`, `article`), fuente con `display: swap`, sin imágenes pesadas.
- No se prometen posiciones ni resultados de búsqueda.

## 7.4 Accesibilidad (objetivo WCAG 2.2 AA, no certificado)

Enlace «Saltar al contenido», foco visible, etiquetas en todos los controles (comprobado automáticamente en el prototipo), objetivos táctiles de 44 px, `aria-live` en resultados, contraste de la paleta (texto principal #0F1B2D sobre blanco), `prefers-reduced-motion` y navegación por teclado del menú móvil. Falta una auditoría con lector de pantalla y una revisión de contraste con herramienta (`14-limitaciones.md`).

# 6. Seguridad y privacidad

| Control del brief | Implementación |
|---|---|
| HTTPS en producción | `assertSafeConfig` exige URL `https://`; HSTS en `next.config.ts` |
| Secretos en servidor | Solo `NEXT_PUBLIC_*` llega al navegador. `server-only` en los módulos sensibles. La prueba **A19** analiza los componentes cliente en busca de secretos o importaciones de servidor |
| Validación de entradas | zod `.strict()` en cada API y acción |
| Sesiones | Supabase Auth con cookies (`@supabase/ssr`); `getUser()` valida contra Auth (no se confía en la cookie sola); refresco en `proxy.ts` |
| Autenticación | Contraseña ≥10 caracteres con letras y números; verificación de correo; recuperación con enlace de duración limitada (configurar 3600 s en Supabase); mensajes neutrales (A16) |
| Autorización por rol | `staff_roles` + `has_role()`; verificación en el layout de `/admin`, en cada API y en RLS |
| Mínimo privilegio | El rol comercial no ve eventos técnicos, auditoría, licencias ni soporte |
| CSRF | Verificación de `Origin` en APIs que cambian estado; cookies SameSite=Lax; las server actions de Next.js validan el origen |
| Límites de solicitudes | Registro (5/15 min por IP), ingreso (10 por IP y 5 por correo), recuperación, compra, soporte, elegibilidad, analítica |
| Webhooks | Firma SHA-256 en tiempo constante, antigüedad máxima, tamaño máximo de 64 KB, confirmación con la API del proveedor |
| Idempotencia | `dedupe_key`, `(provider, tx)` único, `payment_id` único en vigencias y comisiones, `(payment_id, kind)` en tareas |
| Restricción de datos | RLS **forzado** en todas las tablas; probado (A10) |
| Auditoría | `audit_log` inmutable (trigger); se registra cada pago, activación, revocación, pago manual y cancelación |
| Separación de entornos | Proyectos Supabase y URLs de webhook distintos; producción rechaza piezas simuladas |
| Copias y restauración | Supabase Pro: copias diarias. Procedimiento en `08-despliegue.md` §5 |
| Redirecciones abiertas | `safeNext` solo acepta rutas internas |
| Cabeceras | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `noindex` + `no-store` en áreas privadas |

## Datos que NO se guardan

Contraseñas de ZAJUNA, credenciales institucionales, datos de aprendices, evidencias, calificaciones y números de tarjeta o claves bancarias (los gestiona la pasarela). El formulario de soporte rechaza textos del tipo «contraseña: …».

## Riesgos de la extensión que debe revisar su responsable

Las funciones declaradas **consultan, descargan y modifican información académica** en ZAJUNA, por ejemplo el envío de calificaciones y los cambios de fechas en bloque. Esto implica:

1. **Datos personales de aprendices** procesados en el navegador del instructor. ¿Salen del equipo hacia algún servidor? Si salen, LURIA sería encargada del tratamiento (Ley 1581 de 2012).
2. **Acciones masivas**: un error en «modificaciones en bloque» afecta a muchos aprendices. Se recomienda confirmación previa, vista previa y registro local.
3. **Autorización institucional**: la web no asume que el uso de la extensión esté autorizado por el SENA. El aviso de independencia y los términos trasladan la responsabilidad de uso al instructor; un abogado debe validarlo.
4. **Permisos de la extensión**: deben ser mínimos y publicarse en la página de compatibilidad.
5. **Cambios en la plataforma**: una actualización de ZAJUNA puede romper funciones; se recomienda monitoreo y aviso a clientes.

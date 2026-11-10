# 8. Guía de despliegue

> No se despliega producción sin autorización del propietario y sin la matriz de dependencias en verde (`12-matriz-dependencias.md`).

## 1. Supabase

1. Crear dos proyectos: `luria-staging` y `luria-prod`. Para producción, plan Pro: el gratuito se pausa.
2. Aplicar las migraciones en orden: `supabase db push` con la CLI vinculada, o pegarlas en el editor SQL.
3. En Auth → URL Configuration: Site URL = dominio; Redirect URLs = `https://DOMINIO/auth/confirmar`.
4. En Auth → Email Templates, usar enlaces con `token_hash`:
   - Confirmación: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=signup`
   - Recuperación: `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&siguiente=/restablecer`
5. Auth → caducidad de OTP/enlaces: 3600 s. Activar la protección de contraseñas filtradas si el plan la ofrece.
6. Configurar un SMTP propio para correos de Auth (el SMTP incluido tiene límites bajos).
7. Crear el primer administrador (ver `README.md`).

## 2. Wompi

1. Cuenta de comercio a nombre del vendedor definido (`SELLER_IDENTITY`).
2. Sandbox: copiar llave pública, secreto de integridad y secreto de eventos. URL de eventos: `https://STAGING/api/pagos/webhook/wompi`.
3. Probar en sandbox: pago aprobado, rechazado y pendiente, y reenvío del mismo evento desde el panel de Wompi.
4. Producción: llaves de producción, URL de eventos de producción y `WOMPI_ENVIRONMENT=production`.

## 3. Hosting (Vercel Pro o equivalente)

1. Importar el repositorio y cargar las variables de `.env.example` (los secretos solo en el panel).
2. `APP_ENV=production`, `NEXT_PUBLIC_APP_URL=https://dominio`, `CRON_SECRET` aleatorio de 32+ bytes.
3. Cron: `vercel.json` ejecuta `/api/cron/vencimientos` a las 10:00 UTC (05:00 en Colombia). Vercel envía `Authorization: Bearer $CRON_SECRET`.
4. Dominio y HTTPS.
5. Verificar en `/admin/configuracion` que no quede nada pendiente.

Alternativa VPS: `npm run build && npm start` detrás de Nginx o Caddy con TLS, más un cron del sistema que llame la ruta con el encabezado `Authorization`.

## 4. Lista de verificación previa a producción

- [ ] Pruebas: `npm test`, `npm run test:sql`, `npm run typecheck`, `npm run build` sin errores
- [ ] Pruebas de sandbox de Wompi documentadas (aprobado, rechazado, pendiente, duplicado)
- [ ] Licencias: adaptador `http` o `manual` con revocación confirmada, probado en staging
- [ ] Revisión de textos legales y tributarios
- [ ] Sin datos ni testimonios simulados en producción (A20)
- [ ] Enlace real de instalación y número de WhatsApp configurados
- [ ] Al menos un entorno compatible verificado con evidencia
- [ ] Copia de seguridad inicial y prueba de restauración en staging

## 5. Copias de seguridad y restauración

- Supabase Pro hace copias diarias. Antes de cada migración, además, `pg_dump` manual guardado fuera de Supabase.
- Restauración: crear un proyecto nuevo, restaurar el dump, reconfigurar las variables y apuntar el webhook. Probarla al menos una vez por trimestre en staging.
- Tras una restauración, conciliar con el panel de Wompi los pagos posteriores a la copia. Los eventos perdidos pueden reenviarse desde Wompi; el sistema es idempotente.

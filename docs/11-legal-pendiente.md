# 11. Requisitos legales pendientes

> Lista técnica para revisión profesional. **No es asesoría legal ni contable.** Los textos de `src/lib/content/legal.ts` son borradores marcados como tales en el sitio, y `LEGAL_TEXTS_APPROVED=false` bloquea los cobros reales.

## Para abogado

| # | Asunto | Contexto técnico |
|---|---|---|
| L1 | Identidad del vendedor y datos obligatorios en el sitio | Persona natural o jurídica, NIT o documento, domicilio, canales de atención (Ley 1480 de 2011 y Decreto 1074 de 2015 sobre ventas a distancia) |
| L2 | Derecho de retracto (art. 47, Ley 1480) | El servicio se ejecuta al activarse la licencia. ¿Aplica la excepción de servicios cuya ejecución empezó con acuerdo del consumidor? ¿Cómo y cuándo se informa antes del pago? Plazo de 5 días hábiles |
| L3 | Reversión del pago (art. 51, Ley 1480) | Procedimiento, plazos y coordinación con la pasarela. El sistema ya revoca la licencia al recibir la reversión |
| L4 | Política de reembolsos | **No** se publicó «sin reembolsos». Definir casos: falla de activación pasado el SLA, incompatibilidad no advertida, retracto |
| L5 | Garantía del servicio digital | Alcance de la garantía legal y qué ocurre si una función deja de operar por cambios en la plataforma de terceros |
| L6 | Regla de vencimiento mensual | Validar «mismo número de día, fin del día en hora de Colombia» (`05-suscripciones-renovacion.md`) |
| L7 | Renovación automática | Autorización expresa, información previa al cobro, cancelación sencilla |
| L8 | Política de tratamiento de datos (Ley 1581 de 2012, Decreto 1377 de 2013) | Responsable, finalidades, derechos, canal de PQR, transferencias a Supabase, Vercel y Wompi (servidores fuera de Colombia), conservación, posible registro en el RNBD |
| L9 | Comunicaciones comerciales | Consentimiento, WhatsApp, horarios, mecanismo de retiro |
| L10 | Cookies | Banner implementado; validar texto y categorías |
| L11 | Uso de la extensión en plataforma institucional | Términos de uso de ZAJUNA, responsabilidad del instructor, independencia frente al SENA, uso del nombre «ZAJUNA» en el sitio |
| L12 | Tratamiento de datos de aprendices por la extensión | ¿LURIA (extensión) actúa como encargada del tratamiento? Ver `06-seguridad-privacidad.md` |
| L13 | Propiedad intelectual y licencia de uso del software | Términos de la licencia de usuario final |
| L14 | Procedimiento de PQR | Plazos de respuesta y canal oficial |

## Para contador

| # | Asunto |
|---|---|
| C1 | Régimen tributario del vendedor; si el precio de $40.000 incluye o no IVA u otros impuestos |
| C2 | Obligación de factura electrónica ante la DIAN y proveedor tecnológico. **No hay integración con la DIAN** y los comprobantes de la web no son facturas |
| C3 | Retenciones que aplican las pasarelas (p. ej. PayU informa retención en la fuente, ICA y reteIVA en tarjeta) y su conciliación |
| C4 | Tratamiento de comisiones a referidos (soportes, retenciones) |
| C5 | Tratamiento contable de reembolsos y contracargos |

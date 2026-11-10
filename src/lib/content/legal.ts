/**
 * TEXTOS LEGALES — BORRADORES TÉCNICOS PENDIENTES DE REVISIÓN JURÍDICA (LEGAL_TEXTS).
 * No constituyen asesoría legal. Ver docs/legal-pendiente.md para la lista de asuntos
 * que debe revisar un abogado o contador antes de producción.
 * Los campos [entre corchetes] dependen de SELLER_IDENTITY y otras decisiones pendientes.
 */
export interface LegalDoc {
  slug: string;
  title: string;
  sections: { heading: string; body: string[] }[];
}

const SELLER = "[Identidad del vendedor: nombre o razón social, NIT o documento, domicilio, correo y teléfono — PENDIENTE]";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terminos",
    title: "Términos y condiciones",
    sections: [
      { heading: "Quién vende", body: [SELLER, "LURIA es un producto independiente sin relación comercial ni institucional con el SENA."] },
      { heading: "Objeto", body: ["Suscripción mensual individual para usar la extensión de Google Chrome LURIA en un entorno técnicamente compatible."] },
      { heading: "Requisitos", body: ["Google Chrome en computador, entorno compatible verificado y cuenta activa. La extensión no funciona en navegadores móviles."] },
      { heading: "Uso responsable", body: ["El usuario es responsable de usar LURIA conforme a las reglas de la plataforma en la que trabaja y a la normativa de protección de datos aplicable a la información de sus aprendices. LURIA no asume que su uso esté autorizado por ninguna institución."] },
      { heading: "Pendiente de revisión jurídica", body: ["Limitación de responsabilidad, garantías (Ley 1480 de 2011), propiedad intelectual, suspensión por uso indebido y ley aplicable."] },
    ],
  },
  {
    slug: "condiciones-compra",
    title: "Condiciones de compra",
    sections: [
      { heading: "Precio", body: ["$40.000 COP por un mes de suscripción. [Tratamiento tributario (IVA u otro) — PENDIENTE de revisión contable]."] },
      { heading: "Medios de pago", body: ["Los medios disponibles los ofrece la pasarela de pagos seleccionada. LURIA no almacena números de tarjeta ni claves bancarias."] },
      { heading: "Entrega", body: ["El servicio se entrega mediante la activación técnica de la licencia después de verificar el pago. [Plazo máximo de activación — PENDIENTE (ACTIVATION_SLA)]."] },
      { heading: "Comprobantes", body: ["Después del pago recibirás un comprobante de la transacción. Un comprobante no es una factura electrónica. [Facturación — PENDIENTE de definición con contador]."] },
      { heading: "Derecho de retracto", body: ["[PENDIENTE de análisis jurídico: aplicación del artículo 47 de la Ley 1480 de 2011 a un servicio digital cuya ejecución inicia con la activación, y forma de informarlo antes del pago (Decreto 1074 de 2015)]."] },
      { heading: "Reversión del pago", body: ["Cuando proceda según el artículo 51 de la Ley 1480 de 2011, el consumidor puede solicitar la reversión del pago. Si el pago se reversa, la licencia asociada se revoca. [Procedimiento y plazos — PENDIENTE de revisión jurídica]."] },
    ],
  },
  {
    slug: "renovaciones",
    title: "Renovaciones",
    sections: [
      { heading: "Vigencia", body: ["Cada período vence al final del mismo número de día del mes siguiente, en hora de Colombia. Si ese día no existe (por ejemplo, 31), vence el último día de ese mes."] },
      { heading: "Modalidad", body: ["[Renovación manual o automática — PENDIENTE (RENEWAL_MODE)]. En modalidad manual, el cliente paga cada período desde su cuenta. Una renovación automática solo se activará con autorización expresa del cliente y un medio compatible."] },
      { heading: "Sin días gratuitos", body: ["Al vencer el período, el acceso termina. No se conceden días adicionales gratuitos."] },
    ],
  },
  {
    slug: "cancelaciones",
    title: "Cancelaciones",
    sections: [
      { heading: "Cancelar cobros futuros", body: ["Puedes cancelar los cobros futuros en cualquier momento desde tu cuenta. El acceso continúa hasta el final del período pagado."] },
      { heading: "Reembolsos", body: ["[Política de reembolsos — PENDIENTE de análisis jurídico. No se publica una política general de 'sin reembolsos']."] },
    ],
  },
  {
    slug: "privacidad",
    title: "Aviso de privacidad y tratamiento de datos",
    sections: [
      { heading: "Responsable", body: [SELLER] },
      { heading: "Datos tratados", body: ["Nombre, correo, teléfono (opcional), datos de suscripción y pagos, solicitudes de soporte, consentimientos y datos técnicos mínimos de seguridad.", "No tratamos contraseñas institucionales ni información de aprendices en la web comercial."] },
      { heading: "Finalidades", body: ["Gestionar la cuenta, la compra, la activación y el soporte; cumplir obligaciones legales; y, solo con tu autorización expresa, enviarte comunicaciones comerciales."] },
      { heading: "Derechos", body: ["Conocer, actualizar, rectificar y suprimir tus datos y revocar la autorización (Ley 1581 de 2012). [Canal y plazos de atención — PENDIENTE]."] },
      { heading: "Pendiente de revisión jurídica", body: ["Política de tratamiento completa, transferencias a proveedores (alojamiento, pasarela), registro ante la SIC si aplica, conservación."] },
    ],
  },
  {
    slug: "cookies",
    title: "Cookies",
    sections: [
      { heading: "Esenciales", body: ["Sesión y seguridad. Son necesarias para iniciar sesión y comprar."] },
      { heading: "Analítica (opcional)", body: ["Solo se activan si las aceptas. No incluyen datos personales en los eventos."] },
    ],
  },
  {
    slug: "reclamaciones",
    title: "Peticiones, quejas y reclamos",
    sections: [
      { heading: "Cómo reclamar", body: ["Desde Soporte o al canal oficial del vendedor. [Correo, plazos de respuesta y procedimiento — PENDIENTE]."] },
      { heading: "Autoridad", body: ["Superintendencia de Industria y Comercio (SIC) para asuntos de protección al consumidor y datos personales."] },
    ],
  },
];

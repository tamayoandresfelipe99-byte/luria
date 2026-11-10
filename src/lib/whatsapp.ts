/**
 * Enlaces de WhatsApp. El número es configurable (NEXT_PUBLIC_SUPPORT_WHATSAPP); no se inventa ninguno.
 * Los mensajes predefinidos no incluyen datos personales ni académicos.
 */
export const WHATSAPP_TOPICS = {
  comercial: "Hola, quiero información sobre LURIA.",
  instalacion: "Hola, necesito ayuda con la instalación de LURIA.",
  compatibilidad: "Hola, tengo una duda sobre la compatibilidad de LURIA.",
  pago: "Hola, tengo un problema con un pago de LURIA.",
  renovacion: "Hola, tengo una pregunta sobre la renovación de mi suscripción a LURIA.",
  tecnica: "Hola, tengo una incidencia técnica con LURIA.",
} as const;
export type WhatsappTopic = keyof typeof WHATSAPP_TOPICS;

export function whatsappLink(number: string | undefined, topic: WhatsappTopic): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_TOPICS[topic])}`;
}

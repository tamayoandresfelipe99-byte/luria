import { whatsappLink, type WhatsappTopic } from "@/lib/whatsapp";

export function WhatsAppButton({ topic = "comercial", floating = false, label }: { topic?: WhatsappTopic; floating?: boolean; label?: string }) {
  const href = whatsappLink(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP, topic);
  if (!href) {
    return floating ? null : <span className="muted small">WhatsApp: número de atención por configurar.</span>;
  }
  return (
    <a className={floating ? "whatsapp-fab" : "btn btn-ghost"} href={href} target="_blank" rel="noopener noreferrer">
      {label ?? "Escríbenos por WhatsApp"}
    </a>
  );
}

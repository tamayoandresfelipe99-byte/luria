import Link from "next/link";
import { INDEPENDENCE_NOTICE } from "@/lib/content/site";

export function SiteFooter({ sellerIdentity }: { sellerIdentity: string }) {
  return (
    <footer className="site-footer">
      <div className="container grid grid-3">
        <div>
          <strong style={{ color: "#fff", letterSpacing: "0.18em" }}>LURIA</strong>
          <p className="small">Extensión de Google Chrome para apoyar procesos académicos y administrativos de instructores virtuales.</p>
        </div>
        <nav aria-label="Legal" className="stack small">
          <Link href="/legal/terminos">Términos y condiciones</Link>
          <Link href="/legal/condiciones-compra">Condiciones de compra</Link>
          <Link href="/legal/renovaciones">Renovaciones</Link>
          <Link href="/legal/cancelaciones">Cancelaciones</Link>
          <Link href="/legal/privacidad">Privacidad</Link>
          <Link href="/legal/cookies">Cookies</Link>
          <Link href="/legal/reclamaciones">Peticiones, quejas y reclamos</Link>
        </nav>
        <div className="small">
          <p><strong style={{ color: "#fff" }}>Vendedor</strong><br />{sellerIdentity || "Identidad del vendedor pendiente de publicación."}</p>
          <p><Link href="/soporte">Soporte</Link></p>
        </div>
      </div>
      <div className="container independence small">{INDEPENDENCE_NOTICE}</div>
    </footer>
  );
}

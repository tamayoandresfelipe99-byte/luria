import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./RegisterForm";
import { DesktopNotice } from "@/components/Notices";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default function RegistroPage() {
  return (
    <section className="section">
      <div className="container grid grid-2" style={{ alignItems: "start" }}>
        <div>
          <h1>Crea tu cuenta</h1>
          <p className="muted">Con tu cuenta podrás comprar, consultar tu suscripción y pedir soporte. Crear una cuenta no da acceso a la extensión: el acceso se activa después de un pago verificado.</p>
          <DesktopNotice />
          <p>¿Ya tienes cuenta? <Link href="/ingreso">Ingresa</Link></p>
        </div>
        <div className="card"><RegisterForm /></div>
      </div>
    </section>
  );
}

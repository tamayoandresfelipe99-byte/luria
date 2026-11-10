import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default async function IngresoPage({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <h1>Ingresar</h1>
        <div className="card"><LoginForm next={siguiente ?? "/cuenta"} /></div>
        <p style={{ marginTop: 16 }}><Link href="/recuperar-acceso">¿Olvidaste tu contraseña?</Link> · <Link href="/registro">Crear cuenta</Link></p>
      </div>
    </section>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section"><div className="container" style={{ maxWidth: 620 }}>
      <h1>Página no encontrada</h1>
      <p className="muted">La dirección no existe o ya no está disponible.</p>
      <Link href="/" className="btn btn-primary">Ir al inicio</Link>
    </div></section>
  );
}

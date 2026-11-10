"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="section"><div className="container" style={{ maxWidth: 620 }}>
      <h1>Algo salió mal</h1>
      <p className="muted">No pudimos completar la acción. Si estabas pagando, no repitas el pago: revisa el estado en tu cuenta.</p>
      <button className="btn btn-primary" onClick={reset}>Reintentar</button>
    </div></section>
  );
}

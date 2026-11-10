import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ResultPoller } from "./ResultPoller";

export const metadata: Metadata = { title: "Resultado del pago", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * La URL de retorno NO activa nada: esta página solo consulta el estado registrado
 * en el servidor a partir de eventos verificados (A04, A08).
 */
export default async function ResultadoPage({ searchParams }: { searchParams: Promise<{ referencia?: string }> }) {
  const { referencia } = await searchParams;
  await requireUser(`/pago/resultado?referencia=${encodeURIComponent(referencia ?? "")}`);
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 680 }}>
        <h1>Resultado del pago</h1>
        <ResultPoller reference={referencia ?? ""} />
      </div>
    </section>
  );
}

import { notFound } from "next/navigation";
import { appConfig } from "@/lib/services/factory";
import { simulationAllowed } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { SimulatorButtons } from "./SimulatorButtons";

export const dynamic = "force-dynamic";

/** SOLO DESARROLLO. En producción responde 404 (A20). */
export default async function SimuladorPage({ searchParams }: { searchParams: Promise<{ referencia?: string }> }) {
  if (!simulationAllowed(appConfig())) notFound();
  await requireUser("/compra");
  const { referencia } = await searchParams;
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 620 }}>
        <span className="badge badge-sim">SIMULACIÓN</span>
        <h1>Pasarela simulada</h1>
        <p>Pedido <code>{referencia}</code>. Elige el resultado que quieres probar. El evento se firma con el mismo formato de Wompi y recorre el flujo completo de verificación.</p>
        <SimulatorButtons reference={referencia ?? ""} />
      </div>
    </section>
  );
}

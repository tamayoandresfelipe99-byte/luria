import type { Feature } from "@/lib/content/features";
import { claimDisclaimer } from "@/lib/content/features";
import { FeatureStatusBadge } from "./Badges";

export function FeatureCard({ f, detailed = false }: { f: Feature; detailed?: boolean }) {
  const disclaimer = claimDisclaimer(f);
  // En /funciones las tarjetas van justo debajo del h1; en el inicio, debajo de un h2.
  const Title = detailed ? "h2" : "h3";
  const Sub = detailed ? "h3" : "h4";
  return (
    <article className="card" id={f.id} aria-labelledby={`${f.id}-t`}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 10 }}>
        <span className="feature-num" aria-hidden="true">{f.order}</span>
        <FeatureStatusBadge status={f.status} />
      </div>
      <Title id={`${f.id}-t`} className="feature-title">{f.name}</Title>
      <p className="muted">{f.summary}</p>
      {detailed && (
        <>
          <Sub className="feature-sub">Qué problema aborda</Sub>
          <p>{f.problem}</p>
          <Sub className="feature-sub">Qué hace</Sub>
        </>
      )}
      <ul className="check-list">
        {(detailed ? f.characteristics : f.characteristics.slice(0, 3)).map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="benefit"><strong>Beneficio:</strong> {f.benefit}</p>
      {detailed && (
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <div>
            <Sub className="feature-sub">Requisitos</Sub>
            <ul>{f.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <div>
            <Sub className="feature-sub">Limitaciones</Sub>
            <ul>{f.limitations.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
      )}
      {detailed && (
        <p className="small muted">
          Demostración: {f.demo ? <a href={f.demo.url}>ver demostración autorizada</a> : "en preparación. No se publican capturas sin autorización ni con datos de aprendices."}
        </p>
      )}
      {disclaimer && <p className="small muted" style={{ marginTop: 8 }}>{disclaimer}</p>}
    </article>
  );
}

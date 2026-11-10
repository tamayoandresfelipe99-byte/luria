import type { Feature } from "@/lib/content/features";
import { claimDisclaimer } from "@/lib/content/features";
import { FeatureStatusBadge } from "./Badges";

export function FeatureCard({ f, detailed = false }: { f: Feature; detailed?: boolean }) {
  const disclaimer = claimDisclaimer(f);
  return (
    <article className="card" id={f.id} aria-labelledby={`${f.id}-t`}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 10 }}>
        <span className="feature-num" aria-hidden="true">{f.order}</span>
        <FeatureStatusBadge status={f.status} />
      </div>
      <h3 id={`${f.id}-t`}>{f.name}</h3>
      <p className="muted">{f.summary}</p>
      {detailed && (
        <>
          <h4>Qué problema aborda</h4>
          <p>{f.problem}</p>
          <h4>Qué hace</h4>
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
            <h4>Requisitos</h4>
            <ul>{f.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <div>
            <h4>Limitaciones</h4>
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

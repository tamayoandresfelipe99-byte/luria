import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_DOCS } from "@/lib/content/legal";
import { Notice } from "@/components/Notices";
import { appConfig } from "@/lib/services/factory";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  return { title: doc?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!doc) notFound();
  const approved = appConfig().legalTextsApproved;
  return (
    <section className="section">
      <div className="container stack" style={{ maxWidth: 820 }}>
        <h1>{doc.title}</h1>
        {!approved && (
          <Notice kind="warn" title="Borrador pendiente de revisión jurídica">
            Este texto es un borrador técnico. Los apartados entre corchetes dependen de decisiones pendientes y deben revisarse por un abogado antes de habilitar cobros reales.
          </Notice>
        )}
        {doc.sections.map((s) => (
          <div key={s.heading}>
            <h2 style={{ fontSize: "1.25rem" }}>{s.heading}</h2>
            {s.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        ))}
      </div>
    </section>
  );
}

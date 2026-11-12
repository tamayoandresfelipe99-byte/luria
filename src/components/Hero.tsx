import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FEATURES } from "@/lib/content/features";
import { formatCop, PRODUCT } from "@/lib/domain/money";

/** Declaración breve de independencia que acompaña al hero (el aviso completo sigue en el pie y en Contacto). */
export const HERO_INDEPENDENCE = "Producto independiente, sin relación comercial ni respaldo institucional del SENA.";

const svg = (children: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** Iconos de trazo propios, uno por función (sin recursos gráficos de terceros). */
const FEATURE_ICONS: Record<string, ReactNode> = {
  "vigia-calificacion": svg(<><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>),
  "paquete-evidencias": svg(<><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></>),
  "matriz-evidencias": svg(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M3 15h18M9 3v18" /></>),
  "gestor-fechas": svg(<><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="m9 15 2 2 4-4" /></>),
  "juicios-evaluativos": svg(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  reenvios: svg(<><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></>),
};

const ICON_CHECK = svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, 16);
const ICON_ARROW = <span className="btn-arrow" aria-hidden="true">→</span>;

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Hero() {
  const price = formatCop(PRODUCT.priceCop).replace(/\s/g, "");
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="hero-eyebrow hero-anim" style={d(0)}>
            <span className="hero-eyebrow-dot" aria-hidden="true" />
            Herramienta para instructores virtuales
          </p>
          <h1 id="hero-title" className="hero-title hero-anim" style={d(80)}>
            Menos tareas repetitivas. <span className="hl">Más tiempo para enseñar.</span>
          </h1>
          <p className="hero-lead hero-anim" style={d(180)}>
            Simplifica la gestión de evidencias, calificaciones, fechas y actividades de formación virtual con LURIA, una
            extensión diseñada para apoyar tu trabajo en ZAJUNA.
          </p>
          <div className="hero-actions hero-anim" style={d(280)}>
            <Link href="/precio" className="btn btn-primary btn-lg">
              Suscribirme por {price}/mes {ICON_ARROW}
            </Link>
            <a href="#funciones" className="btn btn-ghost btn-lg">Explorar funciones</a>
          </div>
          <ul className="hero-meta hero-anim" style={d(360)}>
            <li>{ICON_CHECK} Sin pruebas gratuitas</li>
            <li>{ICON_CHECK} Chrome en computador</li>
            <li><Link href="/compatibilidad">Consultar compatibilidad →</Link></li>
          </ul>
          <p className="hero-independence hero-anim" style={d(440)}>
            {svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></>, 14)}
            {HERO_INDEPENDENCE}
          </p>
        </div>

        <figure className="hero-visual">
          <div className="hero-visual-in">
            <div className="hv-panel">
              <div className="hv-head">
                <span className="hv-brand"><span className="logo-mark" aria-hidden="true" />LURIA</span>
                <span className="hv-pill">{FEATURES.length} funciones</span>
              </div>
              <ul className="hv-list" aria-label="Funciones de LURIA">
                {FEATURES.map((f, i) => (
                  <li key={f.id} className="hv-item" style={{ "--i": i } as CSSProperties}>
                    <Link href={`/funciones#${f.id}`}>
                      <span className="hv-icon">{FEATURE_ICONS[f.id] ?? svg(<circle cx="12" cy="12" r="8" />)}</span>
                      <span className="hv-text">
                        <span className="hv-name">{f.name}</span>
                        <span className="hv-sum">{f.summary}</span>
                      </span>
                      <span className="hv-chev" aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hv-float hv-float-a" style={d(900)} aria-hidden="true">
              <div className="hv-chip" style={{ "--fd": "1.8s" } as CSSProperties}>
                <span className="hv-chip-icon">{svg(<><path d="M9 3h6v3a2 2 0 1 0 4 0V3h0a2 2 0 0 1 2 2v4h-3a2 2 0 1 0 0 4h3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4Z" /></>, 16)}</span>
                <span>Extensión de Chrome<small>Para computador</small></span>
              </div>
            </div>
            <div className="hv-float hv-float-b" style={d(1050)} aria-hidden="true">
              <div className="hv-chip" style={{ "--fd": "2.6s" } as CSSProperties}>
                <span className="hv-chip-icon">{svg(<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /></>, 16)}</span>
                <span>{price} COP / mes<small>Suscripción individual</small></span>
              </div>
            </div>
          </div>
          <figcaption className="hv-caption hero-anim" style={d(700)}>
            Ilustración de las funciones declaradas por el fabricante. No es una captura de la extensión.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

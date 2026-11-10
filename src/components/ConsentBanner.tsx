"use client";
import { useEffect, useState } from "react";

/** Analítica no esencial solo con consentimiento. La decisión se guarda en una cookie de primera parte. */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(!document.cookie.split("; ").some((c) => c.startsWith("luria_analytics=")));
  }, []);
  if (!visible) return null;
  const decide = (granted: boolean) => {
    document.cookie = `luria_analytics=${granted ? "granted" : "denied"}; Max-Age=${180 * 86400}; Path=/; SameSite=Lax; Secure`;
    setVisible(false);
  };
  return (
    <div className="consent-bar card" role="dialog" aria-labelledby="consent-t" aria-describedby="consent-d">
      <strong id="consent-t">Cookies de medición</strong>
      <p id="consent-d" className="small">
        Usamos cookies esenciales para tu sesión. Con tu permiso, también medimos visitas de forma anónima para mejorar el sitio.{" "}
        <a href="/legal/cookies">Más información</a>.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => decide(true)}>Aceptar medición</button>
        <button className="btn btn-ghost" onClick={() => decide(false)}>Solo esenciales</button>
      </div>
    </div>
  );
}

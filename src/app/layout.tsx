import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SimulationBanner } from "@/components/Notices";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ConsentBanner } from "@/components/ConsentBanner";
import { PageViewTracker } from "@/components/Analytics";
import { appConfig } from "@/lib/services/factory";
import { simulationAllowed } from "@/lib/config";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "LURIA · Extensión de Chrome para instructores virtuales", template: "%s · LURIA" },
  description:
    "LURIA es una extensión de Google Chrome que centraliza procesos académicos y administrativos de instructores que imparten formación virtual en un entorno compatible. Suscripción mensual.",
  openGraph: { type: "website", locale: "es_CO", siteName: "LURIA" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0b2a5b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = appConfig();
  return (
    <html lang="es-CO" className={sans.variable}>
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        {simulationAllowed(cfg) && <SimulationBanner />}
        <SiteHeader />
        <main id="contenido">{children}</main>
        <SiteFooter sellerIdentity={cfg.sellerIdentity} />
        <WhatsAppButton floating />
        <ConsentBanner />
        <PageViewTracker />
      </body>
    </html>
  );
}

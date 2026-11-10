import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/lib/content/legal";

/** Solo páginas públicas. Áreas privadas, administración y datos de clientes quedan fuera. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pub = ["", "/funciones", "/compatibilidad", "/demostracion", "/precio", "/instalacion", "/soporte"];
  return [
    ...pub.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...LEGAL_DOCS.map((d) => ({ url: `${base}/legal/${d.slug}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}

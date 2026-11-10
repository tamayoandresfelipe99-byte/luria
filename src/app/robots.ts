import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const prod = process.env.APP_ENV === "production";
  return {
    rules: prod
      ? [{ userAgent: "*", allow: "/", disallow: ["/admin", "/cuenta", "/compra", "/pago", "/api", "/registro", "/ingreso", "/recuperar-acceso", "/restablecer", "/auth"] }]
      : [{ userAgent: "*", disallow: "/" }], // entornos de prueba no se indexan
    sitemap: `${base}/sitemap.xml`,
  };
}

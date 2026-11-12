import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { roles } = await requireRole(["admin", "comercial", "soporte"]);
  const is = (r: string) => roles.includes(r as never);
  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Administración">
        <Link href="/admin">Vista general</Link>
        <Link href="/admin/clientes">Clientes</Link>
        <Link href="/admin/accesos">Pagos y accesos</Link>
        {(is("admin") || is("comercial")) && <Link href="/admin/pagos">Pagos</Link>}
        {(is("admin") || is("soporte")) && <Link href="/admin/licencias">Licencias</Link>}
        {(is("admin") || is("soporte")) && <Link href="/admin/soporte">Soporte</Link>}
        {(is("admin") || is("comercial")) && <Link href="/admin/comercial">Comercial</Link>}
        {(is("admin") || is("comercial")) && <Link href="/admin/reportes">Reportes</Link>}
        {is("admin") && <Link href="/admin/configuracion">Configuración</Link>}
      </nav>
      <div className="admin-main">
        <p className="small muted" style={{ marginTop: 0 }}>Roles: {roles.join(", ")} · Los datos mostrados son los registrados en la base de datos de este entorno.</p>
        {children}
      </div>
    </div>
  );
}

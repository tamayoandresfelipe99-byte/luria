import Link from "next/link";
import { Logo } from "./Logo";
import { NavMenu } from "./NavMenu";
import { currentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await currentUser().catch(() => null);
  return (
    <header className="site-header">
      <div className="container bar">
        <Logo />
        <NavMenu>
          {user ? (
            <Link href="/cuenta" className="btn btn-ghost">Mi cuenta</Link>
          ) : (
            <>
              <Link href="/ingreso">Ingresar</Link>
              <Link href="/precio" className="btn btn-primary">Suscribirme</Link>
            </>
          )}
        </NavMenu>
      </div>
    </header>
  );
}

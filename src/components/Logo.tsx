import Link from "next/link";

/** Logotipo tipográfico provisional hasta recibir los archivos oficiales de marca (BRAND_ASSETS). */
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="LURIA, ir al inicio">
      <span className="logo-mark" aria-hidden="true" />
      LURIA
    </Link>
  );
}

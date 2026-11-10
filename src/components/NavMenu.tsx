"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NAV } from "@/lib/content/site";

export function NavMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost nav-toggle"
        aria-expanded={open}
        aria-controls="menu-principal"
        onClick={() => setOpen((v) => !v)}
      >
        Menú
      </button>
      <nav id="menu-principal" className="nav" data-open={open} aria-label="Principal" onClick={() => setOpen(false)}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
        {children}
      </nav>
    </>
  );
}

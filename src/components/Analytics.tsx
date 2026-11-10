"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function anonId(): string {
  const k = "luria_aid";
  let v = localStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(k, v);
  }
  return v;
}

export function track(event: string, extra: { channel?: string } = {}) {
  try {
    if (!document.cookie.includes("luria_analytics=granted")) return;
    const body = JSON.stringify({ event, anonId: anonId(), path: location.pathname, channel: extra.channel });
    navigator.sendBeacon?.("/api/analitica", new Blob([body], { type: "application/json" }));
  } catch {
    /* la medición nunca interrumpe la navegación */
  }
}

export function PageViewTracker() {
  const path = usePathname();
  useEffect(() => {
    track(path === "/precio" ? "pricing_view" : "page_view");
  }, [path]);
  return null;
}

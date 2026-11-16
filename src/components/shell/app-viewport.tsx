"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AppViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div data-map-view={pathname === "/map"} className="app-viewport h-dvh overflow-hidden bg-background text-foreground">{children}</div>;
}

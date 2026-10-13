import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";

export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-[#66758B]">Loading your day…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

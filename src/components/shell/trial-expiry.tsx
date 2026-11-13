"use client";
import { useEffect } from "react";

// Move an already-open workspace to billing when its free period ends. The
// server independently enforces expiry on every data request and mutation.
export function TrialExpiry({ endsAt }: { endsAt: string }) {
  useEffect(() => {
    const remaining = () => new Date(endsAt).getTime() - Date.now();
    const check = () => { if (remaining() <= 0) window.location.replace("/billing"); };
    const timer = window.setTimeout(check, Math.max(0, remaining()));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    check();
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", check); window.removeEventListener("pageshow", check); };
  }, [endsAt]);
  return null;
}

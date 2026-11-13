"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          organization: form.get("organization"),
        }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; redirect?: string } | null;
      if (!response.ok || !body?.ok) {
        setError(body?.error || "The account could not be created. Check the details and try again.");
        setPending(false);
        return;
      }
      window.location.assign(body.redirect || "/onboarding");
    } catch {
      setError("The account could not be created. Check the connection and try again.");
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Create your workspace" description="Start your 14-day free trial. For individuals and teams. No credit card required and no automatic charge.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="name">Your name</Label><Input id="name" name="name" className="h-12" required /></div>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" className="h-12" required /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" className="h-12" required minLength={8} /></div>
        <div className="space-y-2"><Label htmlFor="organization">Workspace or company name (optional)</Label><Input id="organization" name="organization" className="h-12" placeholder="Leave blank to use your name" /></div>
        {error ? <p className="text-sm text-[#D94B4B]">{error}</p> : null}
        <Button className="h-12 w-full" type="submit" disabled={pending}>{pending ? "Creating…" : "Start free trial"}</Button>
      </form>
      <p className="mt-4 text-sm"><Link href="/login" className="underline">I already have an account</Link></p>
    </AuthLayout>
  );
}

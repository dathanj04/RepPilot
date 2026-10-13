"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupFormAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupFormAction, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold text-[#19B78A]">RepPilot AI</p>
      <h1 className="mt-2 text-3xl font-semibold">Create your organization</h1>
      <p className="mt-2 text-sm text-[#66758B]">No calendar, map, or AI key is required to start with manual offices.</p>
      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-2"><Label htmlFor="name">Your name</Label><Input id="name" name="name" className="h-12" required /></div>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" className="h-12" required /></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" className="h-12" required /></div>
        <div className="space-y-2"><Label htmlFor="organization">Organization</Label><Input id="organization" name="organization" className="h-12" required /></div>
        {state?.error ? <p className="text-sm text-[#D94B4B]">{state.error}</p> : null}
        <Button className="h-12 w-full" type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-4 text-sm"><Link href="/login" className="underline">I already have an account</Link></p>
    </main>
  );
}

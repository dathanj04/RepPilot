"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginFormAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const demoLogin = process.env.NEXT_PUBLIC_DEMO_LOGIN === "true";

const DEMOS = [
  ["Alex Davis", "Representative", "alex.davis@example-health.test"],
  ["Jordan Lee", "Manager", "jordan.lee@example-health.test"],
  ["Priya Shah", "Org admin", "priya.shah@example-health.test"],
  ["Casey Nguyen", "Compliance", "casey.nguyen@example-health.test"],
  ["Avery Cole", "Platform admin", "avery.cole@reppilot.demo"],
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginFormAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-lg border-slate-300 bg-white px-3 text-base" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-lg border-slate-300 bg-white px-3 text-base" required />
      </div>
      {state?.error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" className="h-12 w-full rounded-lg bg-[#087f5b] text-sm font-semibold text-white hover:bg-[#076b4d]" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {demoLogin ? <div className="space-y-2 pt-2">
        <p className="text-xs font-medium text-[#66758B]">Fictional demo accounts. Type the password from your local seed setting. It is not shown here.</p>
        <div className="grid gap-2">
          {DEMOS.map(([name, role, address]) => (
            <button
              key={address}
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-[#F5F7FA]"
              onClick={() => setEmail(address)}
            >
              <span className="font-medium">{name}</span>
              <span className="ml-2 text-[#66758B]">{role}</span>
            </button>
          ))}
        </div>
      </div> : null}
      <p className="text-sm text-[#66758B]">
        New to RepPilot? <Link className="font-medium text-[#10263E] underline" href="/signup">Start a free trial</Link>
      </p>
    </form>
  );
}

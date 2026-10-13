"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginFormAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMOS = [
  ["Alex Davis", "Representative", "alex.davis@example-health.test"],
  ["Jordan Lee", "Manager", "jordan.lee@example-health.test"],
  ["Priya Shah", "Org admin", "priya.shah@example-health.test"],
  ["Casey Nguyen", "Compliance", "casey.nguyen@example-health.test"],
  ["Avery Cole", "Platform admin", "avery.cole@reppilot.demo"],
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginFormAction, null);
  const [email, setEmail] = useState(DEMOS[0]?.[2] ?? "");
  const [password, setPassword] = useState("RepPilot-demo-2026");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12" required />
      </div>
      {state?.error ? <p className="text-sm text-[#D94B4B]">{state.error}</p> : null}
      <Button type="submit" className="h-12 w-full bg-[#19B78A] text-[#06281f] hover:bg-[#15a37b]" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="space-y-2 pt-2">
        <p className="text-xs font-medium text-[#66758B]">Fictional demo accounts. Password RepPilot-demo-2026</p>
        <div className="grid gap-2">
          {DEMOS.map(([name, role, address]) => (
            <button
              key={address}
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-[#F5F7FA]"
              onClick={() => {
                setEmail(address);
                setPassword("RepPilot-demo-2026");
              }}
            >
              <span className="font-medium">{name}</span>
              <span className="ml-2 text-[#66758B]">{role}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-[#66758B]">
        New organization? <Link className="font-medium text-[#10263E] underline" href="/signup">Create one</Link>
      </p>
    </form>
  );
}

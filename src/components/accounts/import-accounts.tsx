"use client";

import { useState, useTransition } from "react";
import { importAccountsAction } from "@/lib/actions";

export function ImportAccounts() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setMessage(null);
        start(async () => {
          const result = await importAccountsAction(data);
          if ("error" in result && result.error) setMessage(result.error);
          else if ("created" in result) {
            const problems = result.errors?.length ? ` ${result.errors.join(" ")}` : "";
            setMessage(`Imported ${result.created} office${result.created === 1 ? "" : "s"}.${problems}`);
          }
        });
      }}
    >
      <p className="text-sm font-medium">Import offices</p>
      <p className="mt-1 text-xs text-[#66758B]">CSV columns: name, specialty, street, city, state, zip. latitude and longitude are optional.</p>
      <input name="file" type="file" accept=".csv,text/csv" required className="mt-3 block w-full text-sm" />
      <button disabled={pending} className="mt-3 h-11 rounded-xl bg-[#10263E] px-4 text-sm font-medium text-white" type="submit">
        {pending ? "Importing…" : "Import CSV"}
      </button>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </form>
  );
}

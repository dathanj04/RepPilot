"use client";

import { useState } from "react";
import { accountBriefAction, draftEmailAction } from "@/lib/actions";

export function BriefButton({ accountId }: { accountId: string; load?: typeof accountBriefAction }) {
  const [text, setText] = useState<string | null>(null);
  const [sources, setSources] = useState<{ label: string; href: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-2xl bg-[#10263E] p-4 text-white">
      <button
        type="button"
        className="h-11 rounded-xl bg-[#19B78A] px-4 text-sm font-semibold text-[#06281f]"
        onClick={async () => {
          const result = await accountBriefAction(accountId);
          if ("error" in result && result.error) setError(result.error);
          if ("text" in result && result.text) {
            setText(result.text);
            setSources(result.sources);
          }
        }}
      >
        AI Account Brief
      </button>
      {error ? <p className="mt-2 text-sm text-[#F3B544]">{error}</p> : null}
      {text ? <p className="mt-3 text-sm leading-6">{text}</p> : null}
      <div className="mt-2 flex gap-3 text-xs">
        {sources.map((source) => (
          <a key={source.label} href={source.href} className="underline">{source.label}</a>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/60">Built only from recorded visits and open tasks.</p>
    </div>
  );
}

export function DraftButton({ accountId }: { accountId: string }) {
  const [draft, setDraft] = useState<{ subject: string; body: string; to: string } | null>(null);
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <button type="button" className="text-sm font-medium underline" onClick={async () => {
        const result = await draftEmailAction(accountId);
        if ("subject" in result) setDraft(result);
      }}>Draft follow-up</button>
      {draft ? (
        <div className="mt-3 text-sm">
          <p className="font-medium">{draft.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans">{draft.body}</pre>
          <a className="mt-2 inline-block underline" href={`mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}>Open in email</a>
          <p className="mt-1 text-xs text-[#66758B]">Nothing is sent until you send it from your email app.</p>
        </div>
      ) : null}
    </div>
  );
}

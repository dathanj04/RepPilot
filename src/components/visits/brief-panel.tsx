"use client";

import { useState, type ReactNode } from "react";
import type { VisitBrief } from "@/lib/domain/visit-intelligence";

export function BriefPanel({
  accountId,
  brief,
  regenerate,
}: {
  accountId: string;
  brief: VisitBrief;
  regenerate: ReactNode;
}) {
  const [points, setPoints] = useState(brief.talkingPoints.join("\n"));
  const [discussed, setDiscussed] = useState<string[]>([]);
  const [added, setAdded] = useState(false);

  function addToNotes() {
    const key = `reppilot-draft-${accountId}`;
    const current = JSON.parse(localStorage.getItem(key) || "{}") as { summary?: string; type?: string };
    const summary = [current.summary, points].filter(Boolean).join("\n");
    localStorage.setItem(key, JSON.stringify({ ...current, summary }));
    setAdded(true);
  }

  return (
    <section id="brief" className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#19B78A]">Prepare for visit</p>
          <h2 className="mt-1 text-lg font-semibold text-[#10263E]">Your recommended conversation</h2>
        </div>
        {regenerate}
      </div>
      <p className="mt-3 text-sm">{brief.summary}</p>
      <div className="mt-3 rounded-xl bg-[#F5F7FA] p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#66758B]">CRM referral activity</p>
        <p className="mt-1">{brief.referralInsight}</p>
        <p className="mt-1 text-xs text-[#66758B]">
          {brief.freshness === "verified" ? "Verified CRM count. No patient information is included." : "This is not a count of zero."}
        </p>
      </div>
      {brief.theme ? (
        <p className="mt-3 text-sm"><span className="font-medium">This month’s focus:</span> {brief.theme.line}</p>
      ) : null}
      <label className="mt-3 block text-sm font-medium" htmlFor={`points-${accountId}`}>Talking points</label>
      <textarea
        id={`points-${accountId}`}
        className="mt-1 min-h-28 w-full rounded-xl border px-3 py-2 text-sm"
        value={points}
        onChange={(event) => setPoints(event.target.value)}
      />
      <ul className="mt-2 space-y-1 text-sm">
        {points.split("\n").filter(Boolean).map((point) => (
          <li key={point}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={discussed.includes(point)}
                onChange={() => setDiscussed((current) => current.includes(point) ? current.filter((item) => item !== point) : [...current, point])}
              />
              <span className={discussed.includes(point) ? "text-[#66758B] line-through" : ""}>{point}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm"><span className="font-medium">Suggested opener:</span> {brief.opener}</p>
      {brief.outstandingFollowUps.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-medium">Outstanding follow-ups</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {brief.outstandingFollowUps.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      <p className="mt-3 text-sm"><span className="font-medium">Recommended next action:</span> {brief.nextAction}</p>
      <p className="mt-2 text-xs text-[#66758B]">{brief.fallback ? "Prepared from your notes and verified records." : "Opener rewritten by the model from the same facts."}</p>
      <button type="button" onClick={addToNotes} className="mt-3 h-11 rounded-xl bg-[#10263E] px-4 text-sm font-semibold text-white">
        {added ? "Added to visit notes" : "Add to visit notes"}
      </button>
    </section>
  );
}

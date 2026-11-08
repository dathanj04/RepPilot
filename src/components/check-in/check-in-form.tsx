"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic } from "lucide-react";
import { ACTIVITIES, CONTACT_ROLES, INTERACTION_TYPES, NEXT_STEPS, OUTCOMES } from "@/lib/domain/catalog";
import { draftStorageKey, readCheckInDraft } from "@/lib/domain/check-in-draft";
import { extractDictationAction, saveCheckInAction } from "@/lib/actions";

type Contact = { id: string; name: string; roleLabel: string };

export function CheckInForm({
  accountId,
  userId,
  organizationId,
  accountName,
  contacts,
  theme,
  brief,
}: {
  accountId: string;
  userId: string;
  organizationId: string;
  accountName: string;
  contacts: Contact[];
  theme: { id: string; title: string } | null;
  brief?: ReactNode;
}) {
  const router = useRouter();
  const draftKey = draftStorageKey(organizationId, userId, accountId);
  const [type, setType] = useState("office_visit");
  const [outcome, setOutcome] = useState<string | null>("completed");
  const [roles, setRoles] = useState<string[]>([]);
  const [contactId, setContactId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [summary, setSummary] = useState("");
  const [activities, setActivities] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [questions, setQuestions] = useState("");
  const [challenges, setChallenges] = useState("");
  const [resourcesRequested, setResourcesRequested] = useState("");
  const [discussedTheme, setDiscussedTheme] = useState(false);
  const [listening, setListening] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftOnDevice, setDraftOnDevice] = useState(false);

  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        // Legacy drafts were shared by all signed-in users of this browser.
        localStorage.removeItem(`reppilot-draft-${accountId}`);
        const draft = readCheckInDraft(localStorage.getItem(draftKey));
        if (draft) {
          setSummary(draft.summary); setType(draft.type); setOutcome(draft.outcome);
          setRoles(draft.roles); setContactId(draft.contactId); setOtherName(draft.otherName);
          setActivities(draft.activities); setSteps(draft.steps); setFollowUpDate(draft.followUpDate);
          setQuestions(draft.questions); setChallenges(draft.challenges);
          setResourcesRequested(draft.resourcesRequested); setDiscussedTheme(draft.discussedTheme);
          setDraftOnDevice(true);
        }
      } catch { /* Storage can be unavailable in a private browser. */ }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, accountId]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ summary, type, outcome, roles, contactId, otherName, activities, steps, followUpDate, questions, challenges, resourcesRequested, discussedTheme }));
    } catch { /* Saving a check-in must still work when draft storage is blocked. */ }
  }, [draftReady, draftKey, summary, type, outcome, roles, contactId, otherName, activities, steps, followUpDate, questions, challenges, resourcesRequested, discussedTheme]);

  function toggle(list: string[], value: string, setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function dictate() {
    const Speech = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!Speech) {
      setError("This browser cannot transcribe speech. Type the note instead.");
      return;
    }
    const recognition = new Speech();
    recognition.lang = "en-US";
    recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setSummary(transcript);
      setListening(false);
      const result = await extractDictationAction(transcript);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (!("extraction" in result) || !result.extraction) return;
      const extraction = result.extraction;
      if (extraction.interactionType) setType(extraction.interactionType);
      setOutcome(extraction.outcome);
      setRoles(extraction.contactRoles);
      if (extraction.contactNames[0]) setOtherName(extraction.contactNames[0]);
      setSummary(extraction.summary || transcript);
      setActivities(extraction.completedActivities);
      const mapped = extraction.suggestedTasks.map((task) => {
        if (/email/i.test(task.title)) return "send_email";
        if (/lunch/i.test(task.title)) return "schedule_lunch";
        if (/follow/i.test(task.title)) return "follow_up";
        return "custom";
      });
      setSteps(mapped);
      const dated = extraction.suggestedTasks.find((task) => task.dueDate)?.dueDate;
      if (dated) setFollowUpDate(dated);
      setProvider(result.provider);
      setError(null);
    };
    recognition.onerror = () => {
      setListening(false);
      setError("Transcription stopped. You can type the note.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    try { recognition.start(); }
    catch {
      setListening(false);
      setError("Microphone access could not start. You can type the note instead.");
    }
  }

  const needsDate = steps.some((step) => NEXT_STEPS.find((item) => item.id === step)?.needsDate);

  return (
    <form
      className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        const contact = contacts.find((item) => item.id === contactId);
        const participants = [
          ...(contact ? [{ name: contact.name, roleLabel: contact.roleLabel, contactId: contact.id }] : []),
          ...roles.filter((role) => role !== contact?.roleLabel).map((role) => ({ name: otherName || role.replaceAll("_", " "), roleLabel: role })),
          ...(!contact && otherName && roles.length === 0 ? [{ name: otherName, roleLabel: "other" }] : []),
        ];
        const taskTitles = steps.includes("none")
          ? []
          : steps.map((step) => NEXT_STEPS.find((item) => item.id === step)?.label || "Custom task");
        try {
          const result = await saveCheckInAction({
            accountId,
            type,
            outcome: type === "note" ? null : outcome,
            summary,
            activities,
            participants,
            tasks: taskTitles.map((title) => ({ title, dueDate: needsDate ? followUpDate || null : null })),
            occurredAt: new Date().toISOString(),
            questions,
            challenges,
            resourcesRequested,
            discussedThemeId: discussedTheme && theme ? theme.id : null,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          try { localStorage.removeItem(draftKey); } catch { /* Optional local draft storage. */ }
          toast.success("Check-in saved");
          router.push(`/accounts/${accountId}?tab=history&saved=1`);
          router.refresh();
        } catch {
          setError("Check-in could not be saved. Your draft is still here; check your connection and try again.");
        } finally { setSaving(false); }
      }}
    >
      <div>
        <p className="text-xs font-medium tracking-wide text-[#66758B]">CHECK IN</p>
        <h1 className="text-2xl font-semibold">{accountName}</h1>
        <p className="text-sm text-[#66758B]">Defaults are already set. Add only what you want to remember.</p>
      </div>
      <p className="rounded-xl bg-[#FFF7E8] px-3 py-2 text-xs text-[#8A5A00]">Do not dictate patient names, diagnoses, or other patient information.</p>
      {draftOnDevice ? <p className="text-xs text-[#66758B]">A draft is stored on this device. It is not saved to RepPilot until you tap Save Check-In.</p> : null}
      {provider ? (
        <p className="rounded-xl bg-[#E7F8F3] px-3 py-2 text-xs">
          {provider === "gemini" ? "Gemini drafted these fields." : "AI provider is not connected. This draft used keyword extraction."} Review it before saving. Nothing is stored until you save.
        </p>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Interaction</h2>
        <div className="grid grid-cols-2 gap-2">
          {INTERACTION_TYPES.map((item) => (
            <button key={item.id} type="button" onClick={() => setType(item.id)} className={`h-12 rounded-xl text-sm font-medium ${type === item.id ? "bg-[#10263E] text-white" : "bg-white ring-1 ring-slate-200"}`}>{item.label}</button>
          ))}
        </div>
      </section>

      {type !== "note" ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Outcome</h2>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((item) => (
              <button key={item.id} type="button" onClick={() => setOutcome(item.id)} className={`h-10 rounded-full px-3 text-sm ${outcome === item.id ? "bg-[#10263E] text-white" : "bg-white ring-1 ring-slate-200"}`}>{item.label}</button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Who did you meet?</h2>
        <div className="flex flex-wrap gap-2">
          {CONTACT_ROLES.map((item) => (
            <button key={item.id} type="button" onClick={() => toggle(roles, item.id, setRoles)} className={`h-10 rounded-full px-3 text-sm ${roles.includes(item.id) ? "bg-[#19B78A] text-[#06281f]" : "bg-white ring-1 ring-slate-200"}`}>{item.label}</button>
          ))}
        </div>
        {contacts.length > 0 ? (
          <label className="mt-3 block text-sm">
            Link an existing contact
            <select value={contactId} onChange={(event) => setContactId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3">
              <option value="">Optional</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
          </label>
        ) : null}
        <input value={otherName} onChange={(event) => setOtherName(event.target.value)} placeholder="Name, if you want it on the record" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">What was discussed?</h2>
          <button type="button" onClick={dictate} className={`grid size-11 place-items-center rounded-full ${listening ? "bg-[#D94B4B] text-white" : "bg-[#10263E] text-white"}`} aria-pressed={listening} aria-label="Dictate check-in">
            <Mic className="size-4" />
          </button>
        </div>
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} placeholder="Discussed services, answered office questions, and reviewed educational materials." className="w-full rounded-2xl border border-slate-200 p-3 text-sm" />
      </section>

      {brief}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Questions, challenges, and resources</h2>
        <textarea value={questions} onChange={(event) => setQuestions(event.target.value)} rows={2} placeholder="Question the practice asked" className="w-full rounded-2xl border border-slate-200 p-3 text-sm" />
        <textarea value={challenges} onChange={(event) => setChallenges(event.target.value)} rows={2} placeholder="Challenge or objection" className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm" />
        <textarea value={resourcesRequested} onChange={(event) => setResourcesRequested(event.target.value)} rows={2} placeholder="Resource they asked for" className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm" />
        {theme ? (
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={discussedTheme} onChange={(event) => setDiscussedTheme(event.target.checked)} />
            <span>This visit discussed the monthly theme: {theme.title}</span>
          </label>
        ) : null}
        <p className="mt-2 text-xs text-[#66758B]">Follow-ups become tasks only when you select a next step. Suggested commitments are not assigned on their own.</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">What was completed?</h2>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((item) => (
            <button key={item.id} type="button" onClick={() => toggle(activities, item.id, setActivities)} className={`h-10 rounded-full px-3 text-sm ${activities.includes(item.id) ? "bg-[#10263E] text-white" : "bg-white ring-1 ring-slate-200"}`}>{item.label}</button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Next step</h2>
        <div className="flex flex-wrap gap-2">
          {NEXT_STEPS.map((item) => (
            <button key={item.id} type="button" onClick={() => setSteps(item.id === "none" ? ["none"] : [...steps.filter((step) => step !== "none" && step !== item.id), ...(steps.includes(item.id) ? [] : [item.id])])} className={`h-10 rounded-full px-3 text-sm ${steps.includes(item.id) ? "bg-[#F3B544] text-[#14243A]" : "bg-white ring-1 ring-slate-200"}`}>{item.label}</button>
          ))}
        </div>
        {needsDate && !steps.includes("none") ? (
          <label className="mt-3 block text-sm">
            Follow-up date
            <input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
          </label>
        ) : null}
      </section>

      {error ? <p className="text-sm text-[#D94B4B]">{error}</p> : null}
      <button type="submit" disabled={saving} className="h-12 rounded-xl bg-[#19B78A] text-base font-semibold text-[#06281f] disabled:opacity-60">
        {saving ? "Saving…" : "Save Check-In"}
      </button>
    </form>
  );
}

type SpeechRec = {
  lang: string;
  start: () => void;
  onresult: (event: { results: { 0?: { 0?: { transcript?: string } } } }) => void;
  onerror: () => void;
  onend: () => void;
};

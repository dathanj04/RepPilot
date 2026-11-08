import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addContactAction, addNoteAction, accountBriefAction } from "@/lib/actions";
import { formatWhen, formatDay } from "@/lib/format";
import { labelFor, ACTIVITIES, CONTACT_ROLES } from "@/lib/domain/catalog";
import { directionsUrl } from "@/lib/domain/distance";
import { revealToken } from "@/lib/services/links";
import { BriefButton, DraftButton } from "@/components/accounts/account-tools";
import { PrepareVisit } from "@/components/visits/prepare-visit";
import { PageFrame } from "@/components/ui/page";

export const instant = false;

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; saved?: string; notice?: string }>;
}) {
  await connection();
  const user = await requireAppUser();
  const { id } = await params;
  const { tab = "overview", saved, notice } = await searchParams;
  const account = await prisma.account.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
      interactions: { orderBy: { occurredAt: "desc" }, include: { participants: true, user: true } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: true } },
      lunches: { orderBy: { slotStartsAt: "desc" }, include: { order: true } },
      tasks: { where: { status: "OPEN" }, orderBy: { dueDate: "asc" } },
      invitations: { where: { status: "ACTIVE" }, include: { secureLinks: true, slots: true } },
    },
  });
  if (!account) notFound();
  const tabs = ["overview", "contacts", "history", "notes", "lunches"] as const;
  const directions = account.latitude != null && account.longitude != null
    ? directionsUrl({ lat: account.latitude, lng: account.longitude })
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${account.street}, ${account.city}, ${account.state} ${account.zip}`)}`;

  return (
    <PageFrame
      title={account.name}
      subtitle={`${account.street}, ${account.city}, ${account.state} ${account.zip} · ${account.specialty} · ${account.providerCount} providers`}
      action={<Link href={`/accounts/${account.id}/check-in`} className="inline-flex h-12 items-center rounded-xl bg-[#19B78A] px-5 font-semibold text-[#06281f]">Check in</Link>}
    >
      {saved ? <p className="mb-3 rounded-xl bg-[#E7F8F3] px-3 py-2 text-sm">Check-in saved to this account.</p> : null}
      {notice ? <p className="mb-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      {account.isDemo ? <p className="mb-3 text-xs text-[#66758B]">Fictional demonstration office.</p> : null}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Action href={`tel:${account.phone ?? ""}`} label="Call" disabled={!account.phone} />
        <Action href={`mailto:${account.email ?? ""}`} label="Email" disabled={!account.email} />
        <Action href={directions} label="Directions" external />
        <Action href={account.website || "#"} label="Website" disabled={!account.website} external />
        <Action href={`/accounts/${account.id}/check-in`} label="Check In" primary />
        <Action href={`/lunches/new?account=${account.id}`} label="Schedule Lunch" />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <Link key={item} href={`/accounts/${account.id}?tab=${item}`} className={`h-9 shrink-0 rounded-full px-3 text-sm capitalize ${tab === item ? "bg-[#10263E] text-white" : "bg-white ring-1 ring-slate-200"}`}>
            {item}
          </Link>
        ))}
      </div>
      <div className="mt-4">
        {tab === "overview" ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <PrepareVisit organizationId={user.organizationId} userId={user.id} accountId={account.id} timeZone={user.timezone} />
            </div>
            <div className="space-y-3">
              <Card>
                <h2 className="font-semibold text-[#10263E]">Office profile</h2>
                <p className="mt-2">Primary contact: {account.contacts.find((contact) => contact.isPrimary)?.name ?? "Not on file"}</p>
                <p>Last visit: {account.lastVisitAt ? formatDay(account.lastVisitAt, user.timezone) : "Not yet visited"}</p>
                <p>Next follow-up: {account.nextFollowUpAt ? formatDay(account.nextFollowUpAt, user.timezone) : "None"}</p>
                <p>Hours: {account.officeHours ?? "Not recorded"}</p>
                <p>Phone: {account.phone ?? "Not on file"}</p>
                <p>Referral communication preference: {account.referralCommunicationPreference ?? "Not recorded"}</p>
                <p className="text-xs text-[#66758B]">Referral counts appear only after a verified CRM sync. A missing sync is not zero.</p>
              </Card>
              <Card>
                <h2 className="font-semibold text-[#10263E]">Upcoming follow-ups</h2>
                {account.tasks.length === 0 ? <p className="mt-2 text-[#66758B]">No open follow-ups.</p> : null}
                <ul className="mt-2 space-y-2">
                  {account.tasks.map((task) => (
                    <li key={task.id} className="rounded-xl bg-[#F5F7FA] p-3">{task.title}{task.dueDate ? ` · ${formatDay(task.dueDate, user.timezone)}` : ""}</li>
                  ))}
                </ul>
              </Card>
            </div>
            <div className="space-y-3">
              <BriefButton accountId={account.id} load={accountBriefAction} />
              <DraftButton accountId={account.id} />
              <Card>
                <h2 className="font-semibold text-[#10263E]">Recent history</h2>
                {account.interactions.length === 0 ? <p className="mt-2 text-[#66758B]">No visits yet.</p> : null}
                <ul className="mt-2 space-y-2">
                  {account.interactions.slice(0, 3).map((interaction) => (
                    <li key={interaction.id} className="rounded-xl bg-[#F5F7FA] p-3">
                      <p className="text-xs text-[#66758B]">{formatWhen(interaction.occurredAt, user.timezone)}</p>
                      <p className="font-medium capitalize">{interaction.type.replaceAll("_", " ")}</p>
                      <p>{interaction.summary || "No summary."}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        ) : null}
        {tab === "contacts" ? (
          <div className="space-y-3">
            {account.contacts.map((contact) => (
              <Card key={contact.id}>
                <p className="font-medium">{contact.name} {contact.isPrimary ? "· Primary" : ""}</p>
                <p className="text-sm text-[#66758B]">{labelFor(CONTACT_ROLES, contact.roleLabel)}</p>
                {contact.phone ? <a className="text-sm underline" href={`tel:${contact.phone}`}>{contact.phone}</a> : null}
                {contact.email ? <a className="block text-sm underline" href={`mailto:${contact.email}`}>{contact.email}</a> : null}
              </Card>
            ))}
            <form action={addContactAction} className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <input type="hidden" name="accountId" value={account.id} />
              <input name="name" placeholder="Name" className="h-11 rounded-xl border px-3" required />
              <select name="roleLabel" className="h-11 rounded-xl border px-3">{CONTACT_ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select>
              <input name="email" placeholder="Email" className="h-11 rounded-xl border px-3" />
              <input name="phone" placeholder="Phone" className="h-11 rounded-xl border px-3" />
              <label className="text-sm"><input type="checkbox" name="isPrimary" className="mr-2" />Primary contact</label>
              <button className="h-11 rounded-xl bg-[#10263E] text-white" type="submit">Add contact</button>
            </form>
          </div>
        ) : null}
        {tab === "history" ? (
          <ol className="space-y-3">
            {account.interactions.length === 0 ? <p className="text-sm text-[#66758B]">No visits yet.</p> : null}
            {account.interactions.map((interaction) => (
              <li key={interaction.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs text-[#66758B]">{formatWhen(interaction.occurredAt, user.timezone)} · {interaction.user.name}</p>
                <p className="font-medium capitalize">{interaction.type.replaceAll("_", " ")}{interaction.outcome ? ` · ${interaction.outcome.replaceAll("_", " ")}` : ""}</p>
                <p className="mt-1 text-sm">{interaction.summary || "No summary."}</p>
                <p className="mt-1 text-xs text-[#66758B]">{interaction.participants.map((person) => person.name).join(", ")}</p>
                <p className="text-xs">{interaction.completedActivities.map((activity) => labelFor(ACTIVITIES, activity)).join(" · ")}</p>
                <Link href={`/accounts/${account.id}/history/${interaction.id}`} className="mt-2 inline-block text-sm underline">Edit</Link>
              </li>
            ))}
          </ol>
        ) : null}
        {tab === "notes" ? (
          <div className="space-y-3">
            <form action={addNoteAction} className="grid gap-2">
              <input type="hidden" name="accountId" value={account.id} />
              <textarea name="body" rows={3} placeholder="Office note. No patient information." className="rounded-xl border p-3" />
              <button className="h-11 rounded-xl bg-[#10263E] text-white" type="submit">Save note</button>
            </form>
            {account.notes.map((note) => (
              <Card key={note.id}>
                <p className="text-sm">{note.body}</p>
                <p className="text-xs text-[#66758B]">{note.author.name} · {formatDay(note.createdAt, user.timezone)}</p>
              </Card>
            ))}
          </div>
        ) : null}
        {tab === "lunches" ? (
          <div className="space-y-3">
            {account.invitations.map((invitation) => {
              const link = invitation.secureLinks.find((item) => item.purpose === "invitation" && !item.revokedAt);
              let url = "";
              if (link) {
                try { url = `/i/${revealToken(link.tokenCiphertext)}`; } catch { url = ""; }
              }
              return (
                <Card key={invitation.id}>
                  <p className="font-medium">Open invitation</p>
                  <p className="text-sm">{invitation.purpose}</p>
                  <p className="text-xs text-[#66758B]">{invitation.slots.length} offered times · expires {formatDay(invitation.expiresAt, user.timezone)}</p>
                  {url ? <Link className="text-sm underline" href={url}>Open clinic link</Link> : null}
                </Card>
              );
            })}
            {account.lunches.map((lunch) => (
              <Link key={lunch.id} href={`/lunches/${lunch.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="font-medium">{formatWhen(lunch.slotStartsAt, user.timezone)}</p>
                <p className="text-sm capitalize text-[#66758B]">{lunch.status.replaceAll("_", " ").toLowerCase()} · {lunch.order?.status.replaceAll("_", " ").toLowerCase()}</p>
              </Link>
            ))}
            <div className="flex flex-wrap gap-2">
              <Link href={`/lunches/new?account=${account.id}`} className="inline-flex h-11 items-center rounded-xl bg-[#19B78A] px-4 font-semibold text-[#06281f]">Schedule lunch</Link>
              <Link href={`/spending?account=${account.id}`} className="inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm ring-1 ring-slate-200">Spending ledger</Link>
            </div>
          </div>
        ) : null}
      </div>
      <Link href={`/accounts/${account.id}/edit`} className="mt-6 inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium ring-1 ring-slate-200">Edit office</Link>
    </PageFrame>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">{children}</div>;
}

function Action({ href, label, disabled, external, primary }: { href: string; label: string; disabled?: boolean; external?: boolean; primary?: boolean }) {
  const className = `grid h-12 place-items-center rounded-xl text-center text-sm font-medium ${primary ? "bg-[#19B78A] text-[#06281f]" : "bg-white ring-1 ring-slate-200"} ${disabled ? "pointer-events-none opacity-40" : ""}`;
  if (external) return <a className={className} href={href} target="_blank" rel="noreferrer">{label}</a>;
  return <Link className={className} href={disabled ? "#" : href}>{label}</Link>;
}

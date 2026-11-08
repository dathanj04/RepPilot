import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewTeam } from "@/lib/permissions";
import { canManageThemes, themeAdoption } from "@/lib/services/visit-intelligence";
import { saveThemeAction } from "@/lib/visits/actions";

export const instant = false;
export const metadata = { title: "Monthly outreach themes" };

export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; theme?: string; representative?: string; territory?: string; specialty?: string; from?: string; to?: string }>;
}) {
  await connection();
  const query = await searchParams;
  const user = await requireAppUser();
  if (!canViewTeam(user.roleKey)) notFound();
  const [themes, members, territories] = await Promise.all([
    prisma.monthlyTheme.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startDate: "desc" },
      include: { createdBy: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: user.organizationId },
      include: { user: true, role: true },
    }),
    prisma.territory.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);
  const selected = query.theme ? themes.find((theme) => theme.id === query.theme) ?? null : null;
  const reportTheme = selected ?? themes[0] ?? null;
  const report = reportTheme
    ? await themeAdoption(prisma, {
        organizationId: user.organizationId,
        themeId: reportTheme.id,
        representativeId: query.representative || null,
        territoryId: query.territory || null,
        specialty: query.specialty || null,
        from: query.from ? new Date(`${query.from}T12:00:00.000Z`) : null,
        to: query.to ? new Date(`${query.to}T12:00:00.000Z`) : null,
      })
    : null;
  const editable = canManageThemes(user.roleKey);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <Link href="/manager" className="text-sm text-[#66758B]">Team</Link>
      <h1 className="text-2xl font-semibold">Monthly outreach themes</h1>
      {query.notice ? <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{query.notice}</p> : null}
      <p className="text-sm text-[#66758B]">A theme guides the conversation. It does not replace an open follow-up, and referral changes are not attributed to it.</p>
      <ul className="space-y-2">
        {themes.length === 0 ? <li className="text-sm text-[#66758B]">No themes yet.</li> : null}
        {themes.map((theme) => (
          <li key={theme.id}>
            <Link href={`/manager/themes?theme=${theme.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="font-medium">{theme.title}</p>
              <p className="text-xs text-[#66758B]">{theme.status} · {formatInTimeZone(theme.startDate, user.timezone, "MMM d, yyyy")} – {formatInTimeZone(theme.endDate, user.timezone, "MMM d, yyyy")}</p>
              <p className="mt-1 text-sm">{theme.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      {report && reportTheme ? (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="font-semibold">Campaign view · {reportTheme.title}</h2>
          <p className="mt-1 text-xs text-[#66758B]">Representative-reported visits are separate from verified CRM counts and from AI suggestions.</p>
          <form className="mt-3 grid gap-2 sm:grid-cols-2" method="get">
            <input type="hidden" name="theme" value={reportTheme.id} />
            <select name="representative" defaultValue={query.representative || ""} className="h-11 rounded-xl border px-3 text-sm">
              <option value="">All representatives</option>
              {members.map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}
            </select>
            <select name="territory" defaultValue={query.territory || ""} className="h-11 rounded-xl border px-3 text-sm">
              <option value="">All territories</option>
              {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
            </select>
            <input name="specialty" defaultValue={query.specialty || ""} placeholder="Specialty" className="h-11 rounded-xl border px-3 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="from" defaultValue={query.from || ""} className="h-11 rounded-xl border px-3 text-sm" />
              <input type="date" name="to" defaultValue={query.to || ""} className="h-11 rounded-xl border px-3 text-sm" />
            </div>
            <button className="h-11 rounded-xl bg-[#10263E] text-sm text-white" type="submit">Filter</button>
          </form>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[#66758B]">Representatives with a visit</dt><dd className="text-xl font-semibold">{report.representatives}</dd></div>
            <div><dt className="text-[#66758B]">Practices visited</dt><dd className="text-xl font-semibold">{report.visits}</dd></div>
            <div><dt className="text-[#66758B]">Visits that recorded this theme</dt><dd className="text-xl font-semibold">{report.discussed}</dd></div>
            <div><dt className="text-[#66758B]">Follow-up tasks created</dt><dd className="text-xl font-semibold">{report.followUps}</dd></div>
          </dl>
          <p className="mt-3 text-sm">{report.referralLine}</p>
        </section>
      ) : null}
      {editable ? (
        <form action={saveThemeAction} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="font-semibold">Create or update a theme</h2>
          <input type="hidden" name="themeId" value={selected?.id ?? ""} />
          <input name="title" required placeholder="Theme title" defaultValue={selected?.title ?? ""} className="h-11 rounded-xl border px-3" />
          <textarea name="description" placeholder="What should the team focus on?" defaultValue={selected?.description ?? ""} className="min-h-24 rounded-xl border px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="startDate" required defaultValue={selected ? formatInTimeZone(selected.startDate, "UTC", "yyyy-MM-dd") : ""} className="h-11 rounded-xl border px-3" />
            <input type="date" name="endDate" required defaultValue={selected ? formatInTimeZone(selected.endDate, "UTC", "yyyy-MM-dd") : ""} className="h-11 rounded-xl border px-3" />
          </div>
          <textarea name="specialties" placeholder="Specialties, one per line" defaultValue={selected?.targetSpecialties.join("\n") ?? ""} className="min-h-20 rounded-xl border px-3 py-2" />
          <textarea name="talkingPoints" placeholder="Talking points, one per line" defaultValue={selected?.talkingPoints.join("\n") ?? ""} className="min-h-24 rounded-xl border px-3 py-2" />
          <textarea name="resources" placeholder="Resources, one per line" defaultValue={selected?.resources.join("\n") ?? ""} className="min-h-20 rounded-xl border px-3 py-2" />
          <input name="targetMetric" placeholder="Optional target metric" defaultValue={selected?.targetMetric ?? ""} className="h-11 rounded-xl border px-3" />
          <select name="priority" defaultValue={selected?.priority ?? "NORMAL"} className="h-11 rounded-xl border px-3">
            <option value="NORMAL">Normal priority</option>
            <option value="HIGH">High priority</option>
          </select>
          <fieldset>
            <legend className="text-sm font-medium">Target representatives</legend>
            <p className="text-xs text-[#66758B]">Leave everyone unchecked to include the organization.</p>
            {members.map((member) => (
              <label key={member.userId} className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" name="userId" value={member.userId} defaultChecked={selected?.targetUserIds.includes(member.userId)} />
                {member.user.name}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Territories</legend>
            {territories.map((territory) => (
              <label key={territory.id} className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" name="territoryId" value={territory.id} defaultChecked={selected?.targetTerritoryIds.includes(territory.id)} />
                {territory.name}
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-3 gap-2">
            <button name="status" value="DRAFT" className="h-11 rounded-xl bg-white text-sm ring-1 ring-slate-200" type="submit">Save draft</button>
            <button name="status" value="PUBLISHED" className="h-11 rounded-xl bg-[#19B78A] text-sm font-semibold text-[#06281f]" type="submit">Publish</button>
            <button name="status" value="ARCHIVED" className="h-11 rounded-xl bg-white text-sm ring-1 ring-slate-200" type="submit">Archive</button>
          </div>
        </form>
      ) : <p className="text-sm text-[#66758B]">You can review themes. A manager or organization admin publishes them.</p>}
    </div>
  );
}

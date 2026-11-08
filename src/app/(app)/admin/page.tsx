import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageOrg, canReviewCompliance } from "@/lib/permissions";
import { createMemberAction, createTerritoryAction, updateOrgAction } from "@/lib/actions";
import { saveCrmMatchAction, syncReferralAction } from "@/lib/visits/actions";
import { parseOrgSettings } from "@/lib/org-settings";
import { formatWhen } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const { notice } = await searchParams;
  const user = await requireAppUser();
  if (!canManageOrg(user.roleKey) && !canReviewCompliance(user.roleKey)) notFound();
  const [org, members, territories, policy, audits, calendars, crms, accounts] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
    prisma.organizationMembership.findMany({
      where: { organizationId: user.organizationId },
      include: { user: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.territory.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.mealPolicy.findFirst({ where: { organizationId: user.organizationId, active: true } }),
    prisma.auditLog.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.calendarConnection.findMany({ where: { organizationId: user.organizationId } }),
    prisma.externalCRMConnection.findMany({ where: { organizationId: user.organizationId } }),
    prisma.account.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" }, take: 40 }),
  ]);
  const settings = parseOrgSettings(org.settings);
  const integrations = [
    ["Google Maps", Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), "OpenStreetMap is the fallback."],
    ["Google Routes", Boolean(process.env.GOOGLE_MAPS_API_KEY), "Route suggestions stay straight-line without it."],
    ["Gemini", Boolean(process.env.GEMINI_API_KEY), "Check-in extraction uses a local parser without it."],
    ["Email", Boolean(process.env.RESEND_API_KEY), "Messages are logged as demo deliveries without it."],
    ["Google Calendar", Boolean(process.env.GOOGLE_CLIENT_ID), `${calendars.filter((item) => item.provider === "google" && item.status === "connected").length} connected.`],
    ["Microsoft 365", Boolean(process.env.MICROSOFT_CLIENT_ID), "Not connected until OAuth is configured and tested."],
    ["Salesforce", crms.some((item) => item.provider === "salesforce" && item.status === "connected"), "Not a live referral query. Sync does not write a count."],
    ["HubSpot", crms.some((item) => item.provider === "hubspot" && item.status === "connected"), "Not a live referral query. Sync does not write a count."],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
      <h1 className="text-2xl font-semibold">Organization</h1>
      {notice ? <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      {canManageOrg(user.roleKey) ? (
        <form action={updateOrgAction} className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <label className="text-sm">Company name<input name="name" defaultValue={org.name} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
          <label className="text-sm">Email display name<input name="emailFromName" defaultValue={org.name} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Workday start<input name="workdayStart" defaultValue={settings.workdayStart} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
            <label className="text-sm">Workday end<input name="workdayEnd" defaultValue={settings.workdayEnd} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
            <label className="text-sm">Recent visit days<input name="recentVisitDays" type="number" defaultValue={settings.recentVisitDays} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
            <label className="text-sm">Overdue visit days<input name="overdueVisitDays" type="number" defaultValue={settings.overdueVisitDays} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
            <label className="text-sm">Lunch invitation hours<input name="invitationExpiryHours" type="number" defaultValue={settings.invitationExpiryHours} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
            <label className="text-sm">Internal cap ($ / person)<input name="cap" type="number" step="0.01" defaultValue={policy ? policy.perPersonCapCents / 100 : 25} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>
          </div>
          <fieldset className="text-sm">
            <legend className="font-medium">Meeting invitation lifetimes</legend>
            <p className="text-xs text-[#66758B]">Representatives can only issue a lifetime checked here. The default choice on the form is 24 hours.</p>
            {[24, 48, 168].map((hours) => (
              <label key={hours} className="mt-1 flex items-center gap-2">
                <input type="checkbox" name={`allow${hours}`} defaultChecked={settings.allowedInvitationHours.includes(hours as 24 | 48 | 168)} />
                {hours === 168 ? "7 days" : `${hours} hours`}
              </label>
            ))}
          </fieldset>
          <label className="text-sm"><input type="checkbox" name="aiEnabled" defaultChecked={settings.aiEnabled} className="mr-2" />AI features available</label>
          {!policy ? <label className="text-sm"><input type="checkbox" name="createPolicy" className="mr-2" />Create an internal meal policy</label> : <p className="text-xs text-[#66758B]">{policy.name} {policy.version} is active. The cap is an internal company figure, not a federal meal allowance. Entertainment and referral-linked meals stay prohibited.</p>}
          <button className="h-11 rounded-xl bg-[#10263E] text-sm font-medium text-white" type="submit">Save organization settings</button>
        </form>
      ) : (
        <p className="text-sm">Compliance review can see settings. Only an organization administrator can change them.</p>
      )}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">People</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {members.map((member) => <li key={member.id}>{member.user.name} · {member.user.email} · {member.role.name}</li>)}
        </ul>
        {canManageOrg(user.roleKey) ? (
          <form action={createMemberAction} className="mt-3 grid gap-2">
            <input name="name" placeholder="Name" className="h-11 rounded-xl border px-3" required />
            <input name="email" type="email" placeholder="Email" className="h-11 rounded-xl border px-3" required />
            <input name="password" type="password" placeholder="Temporary password" className="h-11 rounded-xl border px-3" required />
            <select name="role" className="h-11 rounded-xl border px-3">
              <option value="REP">Representative</option>
              <option value="MANAGER">Manager</option>
              <option value="COMPLIANCE_ADMIN">Compliance administrator</option>
              <option value="ORG_ADMIN">Organization administrator</option>
            </select>
            <button className="h-11 rounded-xl bg-[#10263E] text-sm text-white" type="submit">Add person</button>
          </form>
        ) : null}
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Territories</h2>
        <ul className="mt-2 text-sm">{territories.map((territory) => <li key={territory.id}>{territory.name}</li>)}</ul>
        {territories.length === 0 ? <p className="text-sm text-[#66758B]">No territory yet.</p> : null}
        {canManageOrg(user.roleKey) ? (
          <form action={createTerritoryAction} className="mt-3 flex gap-2">
            <input name="name" placeholder="Territory name" className="h-11 flex-1 rounded-xl border px-3" required />
            <button className="h-11 rounded-xl bg-[#10263E] px-3 text-sm text-white" type="submit">Add</button>
          </form>
        ) : null}
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-semibold">Integrations</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {integrations.map(([name, live, detail]) => (
            <li key={String(name)}>
              <span className="font-medium">{name}</span> · {live ? "Configured" : "Not configured"}
              <span className="block text-xs text-[#66758B]">{detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#66758B]">Stripe billing is not enabled. Plans in seed data are packaging labels, not charges.</p>
        {notice ? <p className="mt-2 text-sm">{notice}</p> : null}
        <form action={saveCrmMatchAction} className="mt-3 grid gap-2">
          <p className="text-sm font-medium">Review a CRM organization mapping</p>
          <select name="connectionId" className="h-11 rounded-xl border px-3 text-sm" required>
            <option value="">CRM connection</option>
            {crms.map((item) => <option key={item.id} value={item.id}>{item.provider} · {item.status}</option>)}
          </select>
          <select name="accountId" className="h-11 rounded-xl border px-3 text-sm">
            <option value="">No practice yet</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <input name="externalOrganizationId" required placeholder="CRM organization id" className="h-11 rounded-xl border px-3 text-sm" />
          <select name="status" className="h-11 rounded-xl border px-3 text-sm">
            <option value="ambiguous">Ambiguous — hold for review</option>
            <option value="approved">Approved mapping</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="h-11 rounded-xl bg-[#10263E] text-sm text-white" type="submit">Save mapping</button>
        </form>
        <form action={syncReferralAction} className="mt-3 grid gap-2">
          <p className="text-sm font-medium">Try a referral sync</p>
          <select name="accountId" className="h-11 rounded-xl border px-3 text-sm" required>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <select name="provider" className="h-11 rounded-xl border px-3 text-sm">
            <option value="salesforce">Salesforce</option>
            <option value="hubspot">HubSpot</option>
          </select>
          <button className="h-11 rounded-xl bg-white text-sm ring-1 ring-slate-200" type="submit">Sync</button>
          <p className="text-xs text-[#66758B]">Without a connected credential and a live query, this records unavailable or failed and stores no referral count.</p>
        </form>
      </section>
      <section>
        <h2 className="text-sm font-semibold">Recent audit</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {audits.map((entry) => <li key={entry.id}>{formatWhen(entry.createdAt, user.timezone)} · {entry.action}</li>)}
        </ul>
      </section>
    </div>
  );
}

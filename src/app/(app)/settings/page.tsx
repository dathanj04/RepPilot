import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { updateProfileAction } from "@/lib/actions";
import { PROFILE_TIMEZONES } from "@/lib/domain/accounts";
import { canManageOrg, canViewTeam } from "@/lib/permissions";

export const instant = false;
export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const { notice } = await searchParams;
  const user = await requireAppUser();
  const links = [
    ["/notifications", "Alerts"],
    ["/reports", "Reports"],
  ];
  if (canViewTeam(user.roleKey)) links.push(["/manager", "Team"]);
  if (canManageOrg(user.roleKey) || user.roleKey === "COMPLIANCE_ADMIN") links.push(["/admin", "Organization"]);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[#66758B]">{user.organizationName} · {user.roleKey.replaceAll("_", " ").toLowerCase()}</p>
      </div>
      {notice ? <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <form action={updateProfileAction} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <label className="text-sm">Name
          <input name="name" defaultValue={user.name} required className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
        </label>
        <label className="text-sm">Email
          <input value={user.email} readOnly className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-[#F5F7FA] px-3 text-[#66758B]" />
        </label>
        <label className="text-sm">Timezone
          <select name="timezone" defaultValue={PROFILE_TIMEZONES.includes(user.timezone as (typeof PROFILE_TIMEZONES)[number]) ? user.timezone : "America/Chicago"} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3">
            {PROFILE_TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
        <label className="text-sm">Current password
          <input name="currentPassword" type="password" autoComplete="current-password" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
        </label>
        <label className="text-sm">New password
          <input name="nextPassword" type="password" autoComplete="new-password" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
        </label>
        <p className="text-xs text-[#66758B]">Leave the password fields empty to keep the current password. Email changes are handled by an organization administrator.</p>
        <button className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="submit">Save settings</button>
      </form>
      <ul className="grid gap-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="flex h-12 items-center rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-slate-200">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

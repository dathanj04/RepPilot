import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { canManageOrg, canViewTeam } from "@/lib/permissions";
import { logoutAction } from "@/lib/actions";

export const instant = false;
export const metadata = { title: "More" };

export default async function MorePage() {
  await connection();
  const user = await requireAppUser();
  const links = [
    ["/tasks", "Follow-ups"],
    ["/meetings", "Meeting requests"],
    ["/lunches", "Lunches"],
    ["/route", "Plan route"],
    ["/spending", "Spending"],
    ["/settings", "Settings"],
    ["/reports", "Reports"],
    ["/notifications", "Alerts"],
    ["/onboarding", "Setup checklist"],
  ];
  if (canManageOrg(user.roleKey)) links.unshift(["/billing", "Billing & subscription"]);
  if (canViewTeam(user.roleKey)) links.push(["/manager", "Team"]);
  if (canManageOrg(user.roleKey) || user.roleKey === "COMPLIANCE_ADMIN") links.push(["/admin", "Admin"]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <h1 className="text-2xl font-semibold">More</h1>
      <p className="mt-1 text-sm text-[#66758B]">{user.organizationName} · {user.roleKey.replaceAll("_", " ").toLowerCase()}</p>
      <ul className="mt-4 grid gap-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="flex h-14 items-center rounded-2xl bg-white px-4 font-medium ring-1 ring-slate-200">{label}</Link>
          </li>
        ))}
      </ul>
      <form action={logoutAction} className="mt-4">
        <button className="h-12 w-full rounded-xl text-sm text-[#66758B]" type="submit">Sign out</button>
      </form>
    </div>
  );
}

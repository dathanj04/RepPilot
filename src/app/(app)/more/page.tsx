import Link from "next/link";
import {hasBusinessFeatures} from "@/lib/domain/paid-access";
import {BusinessFeatureLink} from "@/components/billing/feature-link";
import { hasBusinessCompliance } from "@/lib/compliance-access";
import { COMPLIANCE_UPGRADE } from "@/lib/domain/compliance-access";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { canManageOrg, canViewTeam } from "@/lib/permissions";
import { logoutAction } from "@/lib/actions";

export const instant = false;
export const metadata = { title: "More" };

export default async function MorePage() {
  await connection();
  const user = await requireAppUser();
  const complianceEnabled = await hasBusinessCompliance(user);
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
  links.unshift(["/billing", "Billing & subscription"]);
  if (canViewTeam(user.roleKey)) links.push(["/manager", "Team"]);
  if (canManageOrg(user.roleKey)) links.push(["/admin", "Admin"]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <h1 className="text-2xl font-semibold">More</h1>
      <p className="mt-1 text-sm text-[#66758B]">{user.organizationName} · {user.roleKey.replaceAll("_", " ").toLowerCase()}</p>
      <ul className="mt-4 grid gap-2">
        <li>{complianceEnabled ? <Link href="/compliance" className="flex h-14 items-center rounded-2xl bg-white px-4 font-medium ring-1 ring-slate-200">Compliance review</Link> : <span aria-disabled="true" title={COMPLIANCE_UPGRADE} className="flex min-h-14 items-center rounded-2xl bg-slate-100 px-4 text-slate-500">Compliance review · Business feature</span>}</li>
        {links.map(([href, label]) => (
          <li key={href}>
            <BusinessFeatureLink locked={!hasBusinessFeatures(user)&&["/lunches","/meetings","/reports","/spending","/manager","/admin"].includes(href)} href={href} className="flex h-14 items-center rounded-2xl bg-white px-4 font-medium ring-1 ring-slate-200">{label}</BusinessFeatureLink>
          </li>
        ))}
      </ul>
      <form action={logoutAction} className="mt-4">
        <button className="h-12 w-full rounded-xl text-sm text-[#66758B]" type="submit">Sign out</button>
      </form>
    </div>
  );
}

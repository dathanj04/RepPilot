import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOrgSettings } from "@/lib/org-settings";
import { PageFrame } from "@/components/ui/page";
import { SchedulingInvitationForm } from "@/components/meetings/invitation-form";

export const instant = false;
export const metadata = { title: "New scheduling invitation" };

export default async function NewMeetingInvitationPage() {
  await connection();
  const user = await requireAppUser();
  const [accounts, org] = await Promise.all([
    prisma.account.findMany({ where: { organizationId: user.organizationId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
  ]);
  const settings = parseOrgSettings(org.settings);
  return (
    <PageFrame title="New scheduling invitation" subtitle="The link expires on the lifetime you choose. The default is 24 hours. The office can request one offered time, and you still have to approve it.">
      <SchedulingInvitationForm accounts={accounts} allowedHours={settings.allowedInvitationHours} />
    </PageFrame>
  );
}

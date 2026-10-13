import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/domain/tokens";
import { formatWhen } from "@/lib/format";
import { PublicShell } from "@/components/clinic/public-shell";
import { OfficeRequest } from "@/components/clinic/clinic-forms";

export const instant = false;
export const metadata = { title: "Your representative" };

export default async function OfficePage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const link = await prisma.secureLinkToken.findFirst({
    where: { tokenHash: hashToken(token), purpose: "office" },
    include: { account: true, organization: true },
  });
  if (!link?.account || link.revokedAt || link.expiresAt <= new Date()) {
    return (
      <PublicShell eyebrow="RepPilot AI" title="This office link is not active.">
        <p className="text-sm text-[#66758B]">Ask your representative for a current link.</p>
      </PublicShell>
    );
  }

  const assignment = await prisma.accountAssignment.findFirst({
    where: { accountId: link.accountId ?? undefined, organizationId: link.organizationId },
    include: { user: true },
  });
  const upcoming = await prisma.lunchBooking.findFirst({
    where: {
      organizationId: link.organizationId,
      accountId: link.account.id,
      status: { notIn: ["CANCELED", "COMPLETED"] },
      slotStartsAt: { gte: new Date() },
    },
    orderBy: { slotStartsAt: "asc" },
  });

  return (
    <PublicShell eyebrow={link.organization.name} title={link.account.name}>
      <p className="text-sm text-[#66758B]">
        {assignment ? `${assignment.user.name} is your representative.` : "Your representative will follow up on requests from this page."}
      </p>
      {upcoming ? (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
          <p className="font-medium">Scheduled educational lunch</p>
          <p className="mt-1">{formatWhen(upcoming.slotStartsAt, upcoming.timezone)}</p>
          <p className="capitalize text-[#66758B]">{upcoming.status.replaceAll("_", " ").toLowerCase()}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm">No upcoming lunch is on file for this office.</p>
      )}
      <div className="mt-4">
        <OfficeRequest token={token} />
      </div>
      {assignment ? (
        <a className="mt-4 inline-block text-sm underline" href={`mailto:${assignment.user.email}`}>
          Contact {assignment.user.name}
        </a>
      ) : null}
    </PublicShell>
  );
}

import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/domain/tokens";
import { EXPIRED_INVITATION_MESSAGE, invitationAccess } from "@/lib/domain/meetings";
import { formatWhen } from "@/lib/format";
import { PublicShell } from "@/components/clinic/public-shell";
import { AcceptProposalForm, MeetingRequestForm, ReplacementRequestForm } from "@/components/meetings/public-form";

export const instant = false;
export const metadata = { title: "Scheduling invitation" };

export default async function SchedulingLinkPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const link = await prisma.secureLinkToken.findFirst({
    where: { tokenHash: hashToken(token), purpose: { in: ["scheduling", "scheduling_reply"] } },
    include: {
      schedulingInvitation: { include: { slots: { orderBy: { startsAt: "asc" } }, createdBy: true, account: true, organization: true } },
      meetingRequest: true,
    },
  });
  const invitation = link?.schedulingInvitation;
  if (!link || !invitation) {
    return (
      <PublicShell eyebrow="Scheduling" title="This scheduling invitation link is not valid.">
        <p className="text-sm text-[#66758B]">Ask your representative for a new link. This page does not open a calendar.</p>
      </PublicShell>
    );
  }
  const now = new Date();
  const access = invitationAccess({
    now,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
    useCount: invitation.useCount,
    maxUses: invitation.maxUses,
    revoked: invitation.status === "REVOKED",
  });
  const contact = invitation.publicContact ? (
    <p className="mt-3 text-sm text-[#66758B]">{invitation.createdBy.name} · {invitation.createdBy.email}</p>
  ) : null;

  if (link.purpose === "scheduling_reply" && link.meetingRequest?.status === "RESCHEDULE_PROPOSED" && !link.revokedAt && link.expiresAt > now) {
    return (
      <PublicShell eyebrow={invitation.organization.name} title="Your representative proposed a different time.">
        <p className="text-sm">{link.meetingRequest.officeName}</p>
        {link.meetingRequest.proposedStartsAt ? <p className="mt-2 font-medium">{formatWhen(link.meetingRequest.proposedStartsAt, invitation.organization.timezone)}</p> : null}
        <p className="mt-2 text-sm text-[#66758B]">Accepting checks the calendar again. It does not book a second meeting.</p>
        <AcceptProposalForm token={token} />
        {contact}
      </PublicShell>
    );
  }

  const showExpired = access === "expired" || invitation.expiresAt <= now;
  if (access !== "open" || link.revokedAt || showExpired) {
    return (
      <PublicShell eyebrow={invitation.organization.name} title={showExpired ? "This scheduling invitation has expired." : "This invitation can no longer book a time."}>
        <p className="text-sm">{showExpired ? EXPIRED_INVITATION_MESSAGE : "This invitation was already used. The request already sent stays with your representative, and this link cannot create another booking."}</p>
        {invitation.account ? <p className="mt-2 text-sm font-medium">{invitation.account.name}</p> : null}
        {contact}
        <ReplacementRequestForm token={token} />
      </PublicShell>
    );
  }

  const slots = invitation.slots.map((slot) => ({ id: slot.id, label: formatWhen(slot.startsAt, invitation.organization.timezone) }));
  return (
    <PublicShell eyebrow={invitation.organization.name} title="Request a meeting time">
      <p className="text-sm font-medium">{invitation.account?.name ?? "Your office"}</p>
      <p className="mt-1 text-sm text-[#66758B]">{invitation.createdBy.name} offered these times. Choosing one sends a request. It does not confirm the calendar.</p>
      <div className="mt-4">
        <MeetingRequestForm token={token} slots={slots} officeName={invitation.account?.name ?? ""} />
      </div>
      {contact}
    </PublicShell>
  );
}

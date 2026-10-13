import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/domain/tokens";
import { formatWhen } from "@/lib/format";
import { PublicShell } from "@/components/clinic/public-shell";
import { InvitationResponse } from "@/components/clinic/clinic-forms";

export const instant = false;
export const metadata = { title: "Lunch invitation" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const link = await prisma.secureLinkToken.findFirst({
    where: { tokenHash: hashToken(token), purpose: "invitation" },
    include: {
      invitation: {
        include: {
          slots: { orderBy: { startsAt: "asc" } },
          account: true,
          createdBy: true,
          organization: true,
        },
      },
    },
  });
  const invitation = link?.invitation;
  if (!link || !invitation) {
    return (
      <PublicShell eyebrow="Educational lunch" title="This invitation link is not valid.">
        <p className="text-sm text-[#66758B]">Ask your representative to send a new invitation. This page cannot open a calendar.</p>
      </PublicShell>
    );
  }

  const now = new Date();
  const expired = Boolean(link.revokedAt) || invitation.expiresAt <= now || invitation.status === "EXPIRED" || invitation.status === "REVOKED";
  if (expired && invitation.status !== "ACCEPTED") {
    return (
      <PublicShell eyebrow={invitation.organization.name} title="This invitation has expired.">
        <p className="text-sm">{invitation.account.name}</p>
        <p className="mt-2 text-sm text-[#66758B]">Ask {invitation.createdBy.name} for a new link. An old invitation cannot book a lunch.</p>
        <Contact email={invitation.createdBy.email} name={invitation.createdBy.name} />
      </PublicShell>
    );
  }

  if (invitation.status === "ACCEPTED") {
    const selected = invitation.slots.find((slot) => slot.id === invitation.selectedSlotId);
    return (
      <PublicShell eyebrow={invitation.organization.name} title="A time from this invitation is already confirmed.">
        <p className="text-sm">{invitation.account.name}</p>
        {selected ? <p className="mt-2 font-medium">{formatWhen(selected.startsAt, invitation.organization.timezone)}</p> : null}
        <p className="mt-2 text-sm text-[#66758B]">This link cannot choose another time.</p>
        <Contact email={invitation.createdBy.email} name={invitation.createdBy.name} />
      </PublicShell>
    );
  }

  const slots = invitation.slots
    .filter((slot) => slot.status === "offered")
    .map((slot) => ({ id: slot.id, label: formatWhen(slot.startsAt, invitation.organization.timezone) }));

  return (
    <PublicShell eyebrow={invitation.organization.name} title="Choose an offered time">
      <p className="text-sm font-medium">{invitation.account.name}</p>
      <p className="mt-1 text-sm text-[#66758B]">{invitation.createdBy.name} offered these times for an educational lunch.</p>
      <p className="mt-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">{invitation.purpose}</p>
      <div className="mt-4">
        {slots.length > 0 ? (
          <InvitationResponse token={token} slots={slots} />
        ) : (
          <p className="text-sm text-[#66758B]">No times are currently available on this invitation.</p>
        )}
      </div>
      <Contact email={invitation.createdBy.email} name={invitation.createdBy.name} />
    </PublicShell>
  );
}

function Contact({ email, name }: { email: string; name: string }) {
  return (
    <a className="mt-4 inline-block text-sm underline" href={`mailto:${email}`}>
      Contact {name}
    </a>
  );
}

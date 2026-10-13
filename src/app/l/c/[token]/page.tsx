import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/domain/tokens";
import { formatTime, formatWhen } from "@/lib/format";
import { PublicShell } from "@/components/clinic/public-shell";
import { ConfirmationResponse } from "@/components/clinic/clinic-forms";

export const instant = false;
export const metadata = { title: "Confirm lunch" };

export default async function ConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const link = await prisma.secureLinkToken.findFirst({
    where: { tokenHash: hashToken(token), purpose: "lunch_confirmation" },
    include: {
      booking: { include: { account: true, representative: true, organization: true } },
    },
  });
  const booking = link?.booking;
  if (!link || !booking) {
    return (
      <PublicShell eyebrow="Educational lunch" title="This confirmation link is not valid.">
        <p className="text-sm text-[#66758B]">Ask your representative for a current link.</p>
      </PublicShell>
    );
  }
  if (link.revokedAt || link.expiresAt <= new Date() || booking.status === "CANCELED") {
    return (
      <PublicShell eyebrow={booking.organization.name} title="This confirmation link is no longer active.">
        <p className="text-sm">{booking.account.name}</p>
        <p className="mt-2 text-sm text-[#66758B]">
          {booking.status === "CANCELED"
            ? "The representative canceled this lunch. This page cannot revive it."
            : "Ask your representative if the lunch is still planned."}
        </p>
        <a className="mt-4 inline-block text-sm underline" href={`mailto:${booking.representative.email}`}>
          Contact {booking.representative.name}
        </a>
      </PublicShell>
    );
  }

  const attendees = booking.confirmedAttendees ?? booking.expectedAttendees;
  return (
    <PublicShell eyebrow={booking.organization.name} title="Please confirm your upcoming lunch">
      <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
        <p className="font-medium">{booking.account.name}</p>
        <p className="mt-2">{formatWhen(booking.slotStartsAt, booking.timezone)}</p>
        <p>Until {formatTime(booking.slotEndsAt, booking.timezone)}</p>
        <p className="mt-2 text-[#66758B]">Expected attendees: {attendees}</p>
        <p className="mt-2">{booking.purpose}</p>
      </div>
      {booking.confirmedAt ? (
        <p className="mt-4 rounded-xl bg-[#E7F8F3] px-3 py-3 text-sm">
          This lunch was confirmed{booking.confirmedByName ? ` by ${booking.confirmedByName}` : ""}. You can still update the attendee count or request a change.
        </p>
      ) : null}
      <div className="mt-4">
        <ConfirmationResponse token={token} defaultAttendees={attendees} />
      </div>
      <a className="mt-4 inline-block text-sm underline" href={`mailto:${booking.representative.email}`}>
        Contact {booking.representative.name}
      </a>
    </PublicShell>
  );
}

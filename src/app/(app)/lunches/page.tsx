import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Lunches" };

export default async function LunchesPage() {
  await connection();
  const user = await requireAppUser();
  const [invitations, lunches] = await Promise.all([
    prisma.lunchInvitation.findMany({
      where: { organizationId: user.organizationId, status: "ACTIVE" },
      include: { account: true, slots: true },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.lunchBooking.findMany({
      where: { organizationId: user.organizationId },
      include: { account: true, order: true },
      orderBy: { slotStartsAt: "desc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lunches</h1>
        <Link href="/lunches/new" className="rounded-xl bg-[#10263E] px-3 py-2 text-sm text-white">Schedule</Link>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-semibold">Waiting on the office</h2>
        {invitations.length === 0 ? <p className="text-sm text-[#66758B]">No open invitations.</p> : null}
        {invitations.map((invitation) => (
          <Link key={invitation.id} href={`/accounts/${invitation.accountId}?tab=lunches`} className="mb-2 block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-medium">{invitation.account.name}</p>
            <p className="text-sm text-[#66758B]">{invitation.slots.length} offered times</p>
          </Link>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Scheduled and past</h2>
        {lunches.map((lunch) => (
          <Link key={lunch.id} href={`/lunches/${lunch.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-medium">{lunch.account.name}</p>
            <p className="text-sm text-[#66758B]">{formatWhen(lunch.slotStartsAt, user.timezone)}</p>
            <p className="text-xs capitalize">{lunch.status.replaceAll("_", " ").toLowerCase()} · order {lunch.order?.status.replaceAll("_", " ").toLowerCase()}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

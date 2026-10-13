import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { PageFrame } from "@/components/ui/page";

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
  const now = new Date();
  const upcoming = lunches.filter((lunch) => lunch.slotStartsAt >= now && (lunch.status === "SCHEDULED" || lunch.status === "CHANGE_REQUESTED"));
  const confirmed = lunches.filter((lunch) => lunch.slotStartsAt >= now && lunch.status === "CONFIRMED");
  const completed = lunches.filter((lunch) => lunch.status === "COMPLETED" || (lunch.slotStartsAt < now && lunch.status !== "CANCELED"));
  const sections = [
    ["Waiting on the office", invitations.map((invitation) => ({
      id: invitation.id,
      href: `/accounts/${invitation.accountId}?tab=lunches`,
      title: invitation.account.name,
      detail: `${invitation.slots.length} offered times`,
    }))],
    ["Upcoming", upcoming.map(card)],
    ["Confirmed", confirmed.map(card)],
    ["Completed", completed.map(card)],
  ] as const;

  return (
    <PageFrame
      title="Lunches"
      subtitle="Invitations, upcoming visits, confirmations, and completed meals stay in separate lists."
      action={<Link href="/lunches/new" className="inline-flex h-11 items-center rounded-xl bg-[#10263E] px-4 text-sm font-medium text-white">Schedule</Link>}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map(([title, items]) => (
          <section key={title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-[#10263E]">{title}</h2>
            {items.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">Nothing in this list.</p> : null}
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="block rounded-xl bg-[#F5F7FA] px-3 py-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-[#66758B]">{item.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageFrame>
  );

  function card(lunch: (typeof lunches)[number]) {
    return {
      id: lunch.id,
      href: `/lunches/${lunch.id}`,
      title: lunch.account.name,
      detail: `${formatWhen(lunch.slotStartsAt, user.timezone)} · ${lunch.status.replaceAll("_", " ").toLowerCase()}`,
    };
  }
}

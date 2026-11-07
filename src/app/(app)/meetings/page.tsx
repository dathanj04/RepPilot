import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { PageFrame } from "@/components/ui/page";

export const instant = false;
export const metadata = { title: "Meeting requests" };

export default async function MeetingsPage() {
  await connection();
  const user = await requireAppUser();
  const requests = await prisma.meetingRequest.findMany({
    where: { organizationId: user.organizationId, invitation: { createdById: user.id } },
    include: { meeting: true },
    orderBy: { createdAt: "desc" },
  });
  const groups = [
    ["Pending your approval", requests.filter((item) => item.status === "PENDING" || item.status === "RESCHEDULE_PROPOSED")],
    ["Confirmed", requests.filter((item) => item.status === "CONFIRMED")],
    ["Closed", requests.filter((item) => !["PENDING", "RESCHEDULE_PROPOSED", "CONFIRMED"].includes(item.status))],
  ] as const;

  return (
    <PageFrame
      title="Meeting requests"
      subtitle="An office request stays pending until you approve it. Nothing is written to an external calendar before that."
      action={<Link href="/meetings/new" className="inline-flex h-11 items-center rounded-xl bg-[#10263E] px-4 text-sm font-medium text-white">New invitation</Link>}
    >
      <div className="grid gap-4">
        {groups.map(([label, items]) => (
          <section key={label}>
            <h2 className="text-sm font-semibold text-[#10263E]">{label}</h2>
            {items.length === 0 ? <p className="mt-2 text-sm text-[#66758B]">None.</p> : null}
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={`/meetings/${item.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="font-medium">{item.officeName}</p>
                    <p className="text-sm text-[#66758B]">{formatWhen(item.requestedStartsAt, user.timezone)} · {item.status.replaceAll("_", " ").toLowerCase()}</p>
                    {item.meeting ? <p className="mt-1 text-xs text-[#66758B]">Calendar sync: {item.meeting.syncState.replaceAll("_", " ")}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageFrame>
  );
}

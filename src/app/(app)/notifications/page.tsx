import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markNotificationsReadAction } from "@/lib/actions";
import { formatWhen } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Alerts" };

export default async function NotificationsPage() {
  await connection();
  const user = await requireAppUser();
  const items = await prisma.notification.findMany({
    where: { userId: user.id, organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <form action={markNotificationsReadAction}>
          <button className="text-sm underline" type="submit">Mark all read</button>
        </form>
      </div>
      {items.length === 0 ? <p className="text-sm text-[#66758B]">No alerts yet.</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className={`rounded-2xl p-4 text-sm ring-1 ring-slate-200 ${item.readAt ? "bg-white" : "bg-[#E7F8F3]"}`}>
            <p className="font-medium">{item.title}</p>
            <p className="mt-1">{item.body}</p>
            <p className="mt-1 text-xs text-[#66758B]">{formatWhen(item.createdAt, user.timezone)}</p>
            {item.href ? <Link className="mt-2 inline-block underline" href={item.href}>Open</Link> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

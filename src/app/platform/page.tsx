import { connection } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/lib/actions";
import { formatCents } from "@/lib/domain/spending";

export const instant = false;
export const metadata = { title: "Platform" };

export default async function PlatformPage() {
  await connection();
  const user = await requirePlatformAdmin();
  const organizations = await prisma.organization.findMany({
    include: { subscription: true, memberships: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#10263E]">RepPilot platform</p>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
        </div>
        <form action={logoutAction}>
          <button className="text-sm underline" type="submit">Sign out</button>
        </form>
      </div>
      <p className="mt-3 text-sm text-[#66758B]">
        This surface lists organizations and plan labels. It does not open representative notes, clinic links, or office records.
      </p>
      <ul className="mt-4 space-y-2">
        {organizations.map((organization) => (
          <li key={organization.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
            <p className="font-medium">{organization.name}</p>
            <p className="text-[#66758B]">
              {organization.memberships.length} people ·               {organization.subscription?.plan ?? "no plan"} · {organization.subscription?.status ?? "none"}
              {organization.subscription?.priceMonthlyCents != null ? ` · ${formatCents(organization.subscription.priceMonthlyCents)} listed / month` : ""}
            </p>
            <p className="text-xs">{organization.isDemo ? "Demonstration data" : "Customer organization"} · billing is not connected</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ImportAccounts } from "@/components/accounts/import-accounts";
import { formatDay } from "@/lib/format";
import { PageFrame } from "@/components/ui/page";

export const instant = false;
export const metadata = { title: "Accounts" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();
  const user = await requireAppUser();
  const { q = "" } = await searchParams;
  const accounts = await prisma.account.findMany({
    where: {
      organizationId: user.organizationId,
      OR: q
        ? [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { specialty: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { name: "asc" },
    include: { contacts: { where: { isPrimary: true }, take: 1 } },
  });
  return (
    <PageFrame
      title="Accounts"
      subtitle={`${accounts.length} offices in this territory. Search by name, city, or specialty.`}
      action={<Link href="/accounts/new" className="inline-flex h-11 items-center rounded-xl bg-[#10263E] px-4 text-sm font-medium text-white">Add office</Link>}
    >
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Search name, city, or specialty" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 shadow-sm" />
      </form>
      {accounts.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-sm ring-1 ring-slate-200">
          <p>No offices match this search.</p>
          <Link href="/accounts/new" className="mt-3 inline-flex h-11 items-center rounded-xl bg-[#19B78A] px-4 font-semibold text-[#06281f]">Add an office</Link>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {accounts.map((account) => (
            <li key={account.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/accounts/${account.id}`} className="text-lg font-semibold text-[#10263E]">{account.name}</Link>
                  <p className="text-sm text-[#66758B]">{account.specialty}</p>
                </div>
                {account.isDemo ? <span className="rounded-full bg-[#F5F7FA] px-2 py-1 text-[11px] font-medium text-[#66758B]">Demo</span> : null}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-[#66758B]">Location</dt>
                  <dd>{account.city}, {account.state}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#66758B]">Contact</dt>
                  <dd>{account.contacts[0]?.name ?? "Not on file"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-[#66758B]">Last visit</dt>
                  <dd>{account.lastVisitAt ? formatDay(account.lastVisitAt, user.timezone) : "Not yet visited"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Link href={`/accounts/${account.id}/check-in`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#19B78A] text-sm font-semibold text-[#06281f]">Check in</Link>
                <Link href={`/accounts/${account.id}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium ring-1 ring-slate-200">Open</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6"><ImportAccounts /></div>
    </PageFrame>
  );
}

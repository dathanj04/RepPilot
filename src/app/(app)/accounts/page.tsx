import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ImportAccounts } from "@/components/accounts/import-accounts";

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
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Link href="/accounts/new" className="rounded-xl bg-[#10263E] px-3 py-2 text-sm font-medium text-white">Add office</Link>
      </div>
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Search name, city, or specialty" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3" />
      </form>
      {accounts.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-sm ring-1 ring-slate-200">
          <p>No offices yet.</p>
          <Link href="/accounts/new" className="mt-3 inline-block font-medium underline">Add the first office</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li key={account.id}>
              <Link href={`/accounts/${account.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-[#66758B]">{account.specialty} · {account.city}, {account.state}</p>
                <p className="text-xs text-[#66758B]">{account.contacts[0]?.name ?? "No primary contact"}{account.isDemo ? " · Demo" : ""}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ImportAccounts />
    </div>
  );
}

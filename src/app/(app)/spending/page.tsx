import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents, summarizeSpending } from "@/lib/domain/spending";
import { formatDay } from "@/lib/format";

export const instant = false;
export const metadata = { title: "Spending" };

export default async function SpendingPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  await connection();
  const user = await requireAppUser();
  const { account: accountId } = await searchParams;
  const year = new Date().getUTCFullYear();
  const rows = await prisma.officeSpendingEntry.findMany({
    where: {
      organizationId: user.organizationId,
      ...(accountId ? { accountId } : {}),
    },
    include: { account: true },
    orderBy: { occurredOn: "desc" },
  });
  const summary = summarizeSpending(
    rows.map((row) => ({
      kind: row.kind === "recorded" ? "recorded" : "commitment",
      amountCents: row.amountCents,
      occurredOn: row.occurredOn,
      bookingId: row.bookingId,
      attendeeCount: row.attendeeCount,
    })),
    year,
  );
  const office = accountId ? rows[0]?.account.name : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Spending ledger</h1>
        <a className="text-sm underline" href={`/api/reports/spending${accountId ? `?account=${accountId}` : ""}`}>Download CSV</a>
      </div>
      {office ? <p className="text-sm text-[#66758B]">{office}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <Stat label={`Recorded in ${year}`} value={formatCents(summary.recordedYearToDateCents)} detail={`${summary.recordedMealCount} completed meals`} />
        <Stat label="Upcoming commitments" value={formatCents(summary.upcomingCommitmentCents)} detail={`${summary.upcomingCount} not yet recorded`} />
      </div>
      <p className="text-xs text-[#66758B]">Recorded spending and future commitments stay separate. A commitment is hidden here once the same lunch has a recorded amount.</p>
      {rows.length === 0 ? <p className="text-sm text-[#66758B]">No spending rows yet.</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.account.name}</p>
                <p className="capitalize text-[#66758B]">{row.kind} · {formatDay(row.occurredOn, user.timezone)} · {row.vendor ?? "Vendor not recorded"}</p>
                <p className="text-xs">Policy review: {row.policyStatus}</p>
              </div>
              <p className="font-semibold">{formatCents(row.amountCents)}</p>
            </div>
            {row.bookingId ? <Link className="mt-2 inline-block underline" href={`/lunches/${row.bookingId}`}>Open lunch</Link> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-[#66758B]">{label}</p>
      <p className="text-xs">{detail}</p>
    </div>
  );
}

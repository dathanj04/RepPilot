import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents, summarizeSpending } from "@/lib/domain/spending";

export const instant = false;
export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await connection();
  const user = await requireAppUser();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [accounts, visits, tasks, lunches, spending] = await Promise.all([
    prisma.account.count({ where: { organizationId: user.organizationId, status: "ACTIVE" } }),
    prisma.accountInteraction.count({ where: { organizationId: user.organizationId, occurredAt: { gte: start } } }),
    prisma.followUpTask.count({ where: { organizationId: user.organizationId, status: "OPEN" } }),
    prisma.lunchBooking.count({ where: { organizationId: user.organizationId, status: { notIn: ["CANCELED", "COMPLETED"] } } }),
    prisma.officeSpendingEntry.findMany({ where: { organizationId: user.organizationId } }),
  ]);
  const summary = summarizeSpending(
    spending.map((row) => ({
      kind: row.kind === "recorded" ? "recorded" : "commitment",
      amountCents: row.amountCents,
      occurredOn: row.occurredOn,
      bookingId: row.bookingId,
    })),
    new Date().getUTCFullYear(),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-sm text-[#66758B]">Counts come from this organization&apos;s records. Referral volume is not a metric.</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Active offices" value={String(accounts)} />
        <Stat label="Check-ins this month" value={String(visits)} />
        <Stat label="Open follow-ups" value={String(tasks)} />
        <Stat label="Open lunches" value={String(lunches)} />
        <Stat label="Recorded spending" value={formatCents(summary.recordedYearToDateCents)} />
        <Stat label="Upcoming commitments" value={formatCents(summary.upcomingCommitmentCents)} />
      </div>
      <Link className="inline-flex h-11 items-center rounded-xl bg-[#10263E] px-4 text-sm font-medium text-white" href="/api/reports/spending">
        Download spending CSV
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-[#66758B]">{label}</p>
    </div>
  );
}

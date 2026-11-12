import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { csvCell, formatCents } from "@/lib/domain/spending";

export async function GET(request: Request) {
  const user = await getCurrentUser({ allowExpiredTrial: true });
  const accountId = new URL(request.url).searchParams.get("account");
  const rows = await prisma.officeSpendingEntry.findMany({
    where: {
      organizationId: user.organizationId,
      ...(accountId ? { accountId } : {}),
    },
    include: { account: true },
    orderBy: { occurredOn: "desc" },
  });
  const header = "kind,office,date,amount,attendees,per_person,vendor,policy_status";
  const lines = rows.map((row) =>
    [
      csvCell(row.kind),
      csvCell(row.account.name),
      csvCell(row.occurredOn.toISOString().slice(0, 10)),
      csvCell(formatCents(row.amountCents)),
      csvCell(row.attendeeCount == null ? "" : String(row.attendeeCount)),
      csvCell(row.perPersonCents != null ? formatCents(row.perPersonCents) : ""),
      csvCell(row.vendor ?? ""),
      csvCell(row.policyStatus),
    ].join(","),
  );
  return new Response([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=reppilot-spending.csv",
    },
  });
}


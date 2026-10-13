import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/domain/spending";

export async function GET(request: Request) {
  const user = await getCurrentUser();
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
      row.kind,
      csv(row.account.name),
      row.occurredOn.toISOString().slice(0, 10),
      formatCents(row.amountCents),
      row.attendeeCount ?? "",
      row.perPersonCents != null ? formatCents(row.perPersonCents) : "",
      csv(row.vendor ?? ""),
      row.policyStatus,
    ].join(","),
  );
  return new Response([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=reppilot-spending.csv",
    },
  });
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

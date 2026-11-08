import { prisma } from "@/lib/db";
import { prepareVisitBrief } from "@/lib/services/visit-intelligence";
import { regenerateBriefAction } from "@/lib/visits/actions";
import { BriefPanel } from "./brief-panel";

export async function PrepareVisit({
  organizationId,
  userId,
  accountId,
  timeZone,
}: {
  organizationId: string;
  userId: string;
  accountId: string;
  timeZone: string;
}) {
  const result = await prepareVisitBrief(prisma, {
    organizationId,
    userId,
    accountId,
    timeZone,
    now: new Date(),
  });
  if (!result.ok) return null;
  return (
    <BriefPanel
      accountId={accountId}
      brief={result.brief}
      regenerate={
        <form action={regenerateBriefAction}>
          <input type="hidden" name="accountId" value={accountId} />
          <button type="submit" className="h-10 rounded-xl bg-white px-3 text-sm font-medium ring-1 ring-slate-200">Regenerate</button>
        </form>
      }
    />
  );
}

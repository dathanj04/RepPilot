import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { subscriberCsv } from "@/lib/domain/subscription-trial";

export async function GET() {
  await requirePlatformAdmin();
  const organizations = await prisma.organization.findMany({
    include: {
      subscription: true,
      memberships: { include: { user: { select: { email: true } }, role: { select: { key: true } } } },
    },
    orderBy: { name: "asc" },
  });
  const csv = subscriberCsv(organizations.map(org => {
    const sub = org.subscription;
    return {
      organizationId: org.id,
      organizationName: org.name,
      email: org.memberships.find(member => member.role.key === "ORG_ADMIN")?.user.email ?? null,
      plan: sub?.plan ?? "none",
      stripeStatus: sub?.stripeSubscriptionId ? (sub.status ?? null) : null,
      trialStart: sub?.trialStart ?? null,
      trialEnd: sub?.trialEnd ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      monthlyAmountCents: sub?.stripeSubscriptionId ? (sub.priceMonthlyCents ?? null) : null,
      currency: sub?.stripeSubscriptionId ? "usd" : null,
    };
  }));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="reppilot-subscribers.csv"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

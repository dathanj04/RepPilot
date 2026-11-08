import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckInForm } from "@/components/check-in/check-in-form";
import { PrepareVisit } from "@/components/visits/prepare-visit";
import { focusThemes } from "@/lib/services/visit-intelligence";
import { themeApplies } from "@/lib/domain/visit-intelligence";
import { formatInTimeZone } from "date-fns-tz";

export const instant = false;
export const metadata = { title: "Check in" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireAppUser();
  const { id } = await params;
  const account = await prisma.account.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { contacts: true },
  });
  if (!account) notFound();
  const now = new Date();
  const themes = await focusThemes(prisma, {
    organizationId: user.organizationId,
    userId: user.id,
    timeZone: user.timezone,
    now,
  });
  const theme = themes.find((item) => themeApplies(item, { specialty: account.specialty, territoryId: account.territoryId }, formatInTimeZone(now, user.timezone, "yyyy-MM-dd"))) ?? null;
  return (
    <CheckInForm
      key={`${user.organizationId}:${user.id}:${account.id}`}
      accountId={account.id}
      userId={user.id}
      organizationId={user.organizationId}
      accountName={account.name}
      contacts={account.contacts.map((contact) => ({ id: contact.id, name: contact.name, roleLabel: contact.roleLabel }))}
      theme={theme ? { id: theme.id, title: theme.title } : null}
      brief={<PrepareVisit organizationId={user.organizationId} userId={user.id} accountId={account.id} timeZone={user.timezone} />}
    />
  );
}

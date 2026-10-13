import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckInForm } from "@/components/check-in/check-in-form";

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
  return <CheckInForm accountId={account.id} accountName={account.name} contacts={account.contacts.map((contact) => ({ id: contact.id, name: contact.name, roleLabel: contact.roleLabel }))} />;
}

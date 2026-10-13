import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createInvitationAction } from "@/lib/actions";
import { InvitationForm } from "@/components/lunches/invitation-form";

export const instant = false;
export const metadata = { title: "Schedule lunch" };

export default async function NewLunchPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  await connection();
  const user = await requireAppUser();
  const { account } = await searchParams;
  const accounts = await prisma.account.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    include: { contacts: { where: { isPrimary: true }, take: 1 } },
  });
  return (
    <div className="mx-auto max-w-xl px-4 py-5">
      <h1 className="text-2xl font-semibold">Schedule an educational lunch</h1>
      <p className="mt-1 mb-4 text-sm text-[#66758B]">The office can only choose times you list here. The link expires, and it cannot open your calendar.</p>
      <InvitationForm accounts={accounts.map((item) => ({ id: item.id, name: item.name, email: item.contacts[0]?.email || item.email || "", contact: item.contacts[0]?.name || "" }))} defaultAccountId={account} action={createInvitationAction} />
    </div>
  );
}

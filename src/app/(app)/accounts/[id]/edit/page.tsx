import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AccountForm } from "../../new/page";
import { accountEditScope } from "@/lib/permissions";
import { saveAccountAction } from "@/lib/actions";

export const instant = false;

export default async function EditAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await connection();
  const user = await requireAppUser();
  const { id } = await params;
  const { notice } = await searchParams;
  const account = await prisma.account.findFirst({ where: { id, ...accountEditScope(user) } });
  if (!account) notFound();
  return (
    <div className="mx-auto max-w-xl px-4 py-5">
      <h1 className="mb-4 text-2xl font-semibold">Edit {account.name}</h1>
      {notice ? <p className="mb-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <AccountForm action={saveAccountAction} account={account} />
    </div>
  );
}

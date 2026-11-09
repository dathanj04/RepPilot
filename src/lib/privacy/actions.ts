"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requirePlatformAdmin } from "../auth";
import { prisma } from "../db";
import { clearPreviewSession, getSession } from "../session";
import { fulfillAccountDeletion, requestAccountDeletion } from "./deletion";

export async function requestAccountDeletionAction(formData: FormData) {
  const user = await getCurrentUser();
  const result = await requestAccountDeletion(prisma, {
    // Identity comes from the authenticated session, never a submitted ID or email.
    userId: user.id,
    password: String(formData.get("password") || ""),
    confirmed: formData.get("confirmed") === "on",
  });
  if (!result.ok) redirect(`/delete-account/confirm?notice=${encodeURIComponent(result.error)}`);
  const session = await getSession();
  session.destroy();
  await clearPreviewSession();
  revalidatePath("/platform/deletion-requests");
  redirect("/delete-account?completed=1");
}

export async function fulfillDeletionRequestAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  if (formData.get("verified") !== "on") {
    redirect("/platform/deletion-requests?notice=Confirm that ownership was verified before erasing an account.");
  }
  const requestId = String(formData.get("requestId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const request = requestId ? await prisma.accountDeletionRequest.findUnique({ where: { id: requestId } }) : null;
  const account = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const userId = request?.userId || account?.id;
  if (!userId) redirect("/platform/deletion-requests?notice=No matching active account.");
  const result = await fulfillAccountDeletion(prisma, { userId, actorId: admin.id });
  if (!result.ok) redirect(`/platform/deletion-requests?notice=${encodeURIComponent(result.error)}`);
  revalidatePath("/platform/deletion-requests");
  redirect("/platform/deletion-requests?notice=Account sign-in and personal records were erased.");
}

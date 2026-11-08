"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../auth";
import { prisma } from "../db";
import { requestAccountDeletion } from "./deletion";

export async function requestAccountDeletionAction(formData: FormData) {
  const user = await getCurrentUser();
  const result = await requestAccountDeletion(prisma, {
    // Identity comes from the authenticated session, never a submitted ID or email.
    userId: user.id,
    password: String(formData.get("password") || ""),
    confirmed: formData.get("confirmed") === "on",
  });
  if (!result.ok) redirect(`/delete-account/confirm?notice=${encodeURIComponent(result.error)}`);
  revalidatePath("/delete-account/confirm");
  revalidatePath("/platform/deletion-requests");
  redirect("/delete-account/confirm?received=1");
}

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import { prisma } from "./db";
import { savePersonalBillingProfile } from "./domain/billing-profile";

export async function saveBillingDetailsAction(form: FormData) {
  const user = await getCurrentUser({ allowExpiredTrial: true });
  const result = await savePersonalBillingProfile(prisma, user.id, { billingName: String(form.get("billingName") || ""), billingEmail: String(form.get("billingEmail") || "") });
  if ("error" in result) redirect(`/billing?error=${encodeURIComponent(result.error!)}`);
  revalidatePath("/billing");
  redirect("/billing?saved=1");
}

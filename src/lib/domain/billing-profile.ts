type BillingProfileStore = { user: { update(args: { where: { id: string }; data: { billingName: string; billingEmail: string } }): Promise<unknown> } };
export async function savePersonalBillingProfile(db: BillingProfileStore, userId: string, input: { billingName: string; billingEmail: string }) {
  const billingName = input.billingName.trim();
  const billingEmail = input.billingEmail.trim().toLowerCase();
  if (billingName.length < 2 || billingName.length > 120) return { error: "Use a billing name between 2 and 120 characters." };
  if (billingEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) return { error: "Enter a valid billing email." };
  await db.user.update({ where: { id: userId }, data: { billingName, billingEmail } });
  return { saved: true };
}

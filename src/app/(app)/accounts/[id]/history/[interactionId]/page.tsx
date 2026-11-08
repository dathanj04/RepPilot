import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateCheckInAction } from "@/lib/actions";
import { ACTIVITIES, OUTCOMES } from "@/lib/domain/catalog";

export const instant = false;

export default async function EditCheckInPage({ params }: { params: Promise<{ id: string; interactionId: string }> }) {
  await connection();
  const user = await requireAppUser();
  const { id, interactionId } = await params;
  const interaction = await prisma.accountInteraction.findFirst({
    where: { id: interactionId, accountId: id, organizationId: user.organizationId, userId: user.id },
  });
  if (!interaction) notFound();
  return (
    <form action={updateCheckInAction} className="mx-auto grid max-w-xl gap-3 px-4 py-5">
      <h1 className="text-2xl font-semibold">Edit check-in</h1>
      <input type="hidden" name="interactionId" value={interaction.id} />
      <textarea name="summary" defaultValue={interaction.summary} rows={5} className="rounded-xl border p-3" />
      <select name="outcome" defaultValue={interaction.outcome ?? ""} className="h-11 rounded-xl border px-3">
        <option value="">No outcome</option>
        {OUTCOMES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <div className="grid gap-1 text-sm">
        {ACTIVITIES.map((activity) => (
          <label key={activity.id}><input type="checkbox" name="activities" value={activity.id} defaultChecked={interaction.completedActivities.includes(activity.id)} className="mr-2" />{activity.label}</label>
        ))}
      </div>
      <button className="h-12 rounded-xl bg-[#10263E] text-white" type="submit">Save correction</button>
    </form>
  );
}

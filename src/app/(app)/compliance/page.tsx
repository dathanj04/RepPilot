import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { hasBusinessCompliance } from "@/lib/compliance-access";
import { COMPLIANCE_UPGRADE } from "@/lib/domain/compliance-access";
import { canReviewCompliance } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { decideCateringAction, reviewExceptionAction } from "@/lib/actions";
import { PageFrame } from "@/components/ui/page";
export const instant=false;
export default async function CompliancePage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 await connection();const user=await requireAppUser();const {notice}=await searchParams;
 if(!(await hasBusinessCompliance(user))) return <PageFrame title="Compliance review"><div aria-disabled="true" title={COMPLIANCE_UPGRADE} className="rounded-xl bg-slate-100 p-6 text-slate-500">{COMPLIANCE_UPGRADE}<Link href="/billing" className="mt-3 block underline">View Business plans</Link></div></PageFrame>;
 if(!canReviewCompliance(user.roleKey)) return <PageFrame title="Compliance review"><p>Your account administrator reviews meal policies, catering requests, and policy exceptions.</p></PageFrame>;
 const [policy,orders,exceptions]=await Promise.all([
  prisma.mealPolicy.findFirst({where:{organizationId:user.organizationId,active:true}}),
  prisma.lunchBooking.findMany({where:{organizationId:user.organizationId,order:{approvalStatus:"PENDING"}},include:{account:true,order:true},orderBy:{slotStartsAt:"asc"}}),
  prisma.policyExceptionRequest.findMany({where:{organizationId:user.organizationId,status:"pending"},orderBy:{createdAt:"asc"}})
 ]);
 return <PageFrame title="Compliance review" subtitle="Account administrator review of internal company policy—not a legal certification.">
 {notice?<p role="status" className="mb-4 rounded-xl bg-white p-4">{notice}</p>:null}
 <section className="mb-5 rounded-xl bg-white p-5 ring-1 ring-slate-200"><h2 className="font-semibold">Company meal policy</h2><p className="mt-2">{policy?`${policy.name} · version ${policy.version} · $${(policy.perPersonCapCents/100).toFixed(2)} per attendee`:'No approved company policy is configured. Enter your actual company policy before approving orders.'}</p><Link href="/admin" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Configure company meal policy</Link></section>
 <h2 className="mb-3 font-semibold">Catering awaiting admin review</h2>
 {!orders.length?<p className="mb-4 text-sm">No pending catering reviews.</p>:null}
 {orders.map(lunch=><section key={lunch.id} className="mb-4 rounded-xl bg-white p-5 ring-1 ring-slate-200"><Link href={`/lunches/${lunch.id}`} className="font-semibold underline">{lunch.account.name} · Open lunch details</Link><p className="mt-2 text-sm">{lunch.slotStartsAt.toLocaleString('en-US',{timeZone:lunch.timezone})} ({lunch.timezone})</p>
 {lunch.representativeId===user.id?<p className="mt-3 text-sm">A different account administrator must review catering for a lunch you own.</p>:<form action={decideCateringAction} className="mt-3 grid gap-2"><input type="hidden" name="bookingId" value={lunch.id}/><textarea name="note" required placeholder="Administrator review notes" className="rounded-xl border p-3"/><button disabled={!policy} name="decision" value="approve" className="min-h-11 rounded-xl bg-[#10263E] text-white disabled:opacity-40">Approve catering</button><button name="decision" value="decline" className="min-h-11 rounded-xl border">Decline catering</button></form>}</section>)}
 <h2 className="mb-3 font-semibold">Policy exceptions awaiting review</h2>
 {!exceptions.length?<p className="text-sm">No pending policy exceptions.</p>:null}
 {exceptions.map(request=><form key={request.id} action={reviewExceptionAction} className="mb-4 grid gap-2 rounded-xl bg-white p-5 ring-1 ring-slate-200"><input type="hidden" name="requestId" value={request.id}/><p>{request.reason}</p><textarea name="note" required placeholder="Administrator review notes" className="rounded-xl border p-3"/><button name="decision" value="approve" className="min-h-11 rounded-xl border">Approve permitted exception</button><button name="decision" value="deny" className="min-h-11 rounded-xl border">Deny exception</button></form>)}
 </PageFrame>;
}

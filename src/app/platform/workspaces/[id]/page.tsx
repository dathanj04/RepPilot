import {connection} from "next/server";
import {notFound} from "next/navigation";
import Link from "next/link";
import {requirePlatformAdmin} from "@/lib/auth";
import {prisma} from "@/lib/db";
import {PlatformChangeForm} from "@/components/platform/change-form";
import {customerSubscriptions,stripeConfigured} from "@/lib/stripe";
import {isPaidSubscription,tierForPriceId} from "@/lib/domain/paid-access";
export const instant=false;
export default async function Workspace({params}:{params:Promise<{id:string}>}){
 await connection();await requirePlatformAdmin();const {id}=await params;
 const org=await prisma.organization.findUnique({where:{id},include:{subscription:true,memberships:{include:{role:true,user:{select:{id:true,name:true,email:true,disabledAt:true}}},take:100},_count:{select:{accounts:true,routes:true,lunchBookings:true,memberships:true}}}});
 if(!org)notFound();
 let billing="No Stripe customer is bound to this workspace.";
 const customer=org.subscription?.stripeCustomerId;
 if(customer&&stripeConfigured()){try{const all=await customerSubscriptions(customer);const current=all.data.filter(s=>s.livemode&&s.customer===customer&&s.metadata?.organizationId===id&&!["canceled","incomplete_expired"].includes(s.status));billing=current.length?current.map(s=>(tierForPriceId(s.items.data[0]?.price.id??"")??"unrecognized plan")+" · "+s.status+" · "+(isPaidSubscription(s,customer,id)?"paid access verified":"paid access not verified")).join("; "):"No current live Stripe subscription.";}catch{billing="Stripe could not be reached. Stored status is not proof of payment.";}}
 const protectedOrg=org.memberships.some(m=>m.role.key==="PLATFORM_ADMIN");
 return <><Link href="/platform" className="underline">Back to overview</Link><h1 className="text-3xl font-bold">{org.name}</h1><p className="text-sm text-slate-500">{org.slug} · {org.suspendedAt?"Workspace paused":"Workspace active"}</p>
 <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><h2 className="text-lg font-semibold">Subscription & billing</h2><p className="mt-2">{billing}</p><p className="mt-2 text-sm text-slate-500">Stored: {org.subscription?.plan??"none"} / {org.subscription?.status??"none"} · Trial ends: {org.subscription?.trialEndsAt?.toISOString()??"none"}</p>{customer&&/^cus_[A-Za-z0-9]+$/.test(customer)?<a href={"https://dashboard.stripe.com/customers/"+customer} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center underline">Manage customer in Stripe ↗</a>:null}<p className="mt-2 text-xs text-slate-500">Refunds, cancellations and price changes are confirmed in Stripe. Pausing app access does not stop subscription billing.</p></section>
 <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><h2 className="text-lg font-semibold">Workspace access</h2><p className="mt-2">{org._count.accounts} accounts · {org._count.routes} saved routes · {org._count.lunchBookings} lunch records · {org._count.memberships} members</p>{protectedOrg?<p className="mt-3">Platform administrator workspace is protected.</p>:<PlatformChangeForm kind="workspace" id={org.id} value={org.suspendedAt?"resume":"pause"} label={org.suspendedAt?"Resume workspace access":"Pause workspace access"}/>}</section>
 <section className="space-y-3"><h2 className="text-xl font-semibold">Members</h2>{org._count.memberships>100?<p>Showing the first 100. Search Users to find another member.</p>:null}{org.memberships.map(m=><article key={m.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="font-semibold">{m.user.name}</p><p className="break-all text-sm">{m.user.email} · {m.role.key} · {m.user.disabledAt?"disabled":"enabled"}</p>{m.role.key!=="PLATFORM_ADMIN"?<PlatformChangeForm kind="role" id={m.id} value={m.role.key} roles label="Change organization role"/>:null}</article>)}</section></>;
}

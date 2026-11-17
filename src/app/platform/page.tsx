import Link from "next/link";
import {connection} from "next/server";
import {requirePlatformAdmin} from "@/lib/auth";
import {prisma} from "@/lib/db";
export const instant=false;
export const metadata={title:"Owner overview"};
export default async function PlatformPage({searchParams}:{searchParams:Promise<{q?:string;p?:string}>}){
 await connection();await requirePlatformAdmin();const query=await searchParams,q=(query.q??"").slice(0,100),page=Math.max(0,Math.min(10000,Number(query.p)||0));
 const [orgs,organizations,users,lunches,routes,failed]=await Promise.all([
 prisma.organization.findMany({where:q?{OR:[{name:{contains:q,mode:"insensitive"}},{slug:{contains:q,mode:"insensitive"}}]}:{},include:{subscription:true,_count:{select:{memberships:true,accounts:true,routes:true}}},orderBy:{id:"asc"},skip:page*50,take:51}),
 prisma.organization.count(),prisma.user.count(),prisma.lunchBooking.count({where:{status:{notIn:["CANCELED","COMPLETED"]}}}),prisma.dailyRoute.count(),prisma.notificationDelivery.count({where:{status:"failed"}})
 ]);
 return <><h1 className="text-3xl font-bold">Platform overview</h1><p className="text-sm text-slate-600">Manage customer access and support operations. Every administrative change requires your password, confirmation, and a recorded reason.</p>
 <section className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Workspaces",organizations],["Users",users],["Pending / upcoming lunches",lunches],["Saved routes",routes],["Failed emails",failed]].map(([label,value])=><article key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></article>)}</section>
 <form className="flex gap-2" action="/platform"><label className="flex-1"><span className="sr-only">Search workspaces</span><input name="q" defaultValue={q} placeholder="Search workspace name or slug" className="min-h-12 w-full rounded-xl border bg-white px-3"/></label><button className="rounded-xl bg-[#10263E] px-4 text-white">Search</button></form>
 <section className="space-y-3"><h2 className="text-xl font-semibold">Workspaces</h2>{orgs.slice(0,50).map(org=><Link href={"/platform/workspaces/"+org.id} key={org.id} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="font-semibold">{org.name} {org.suspendedAt?<span className="text-red-700">· Paused</span>:null}</p><p className="mt-1 text-sm text-slate-500">{org._count.memberships} users · {org._count.accounts} accounts · {org._count.routes} routes · stored plan: {org.subscription?.plan??"none"} / {org.subscription?.status??"none"}</p></Link>)}{!orgs.length?<p>No matching workspaces.</p>:null}</section>
 <div className="flex gap-5">{page>0?<Link className="underline" href={"/platform?q="+encodeURIComponent(q)+"&p="+(page-1)}>Previous</Link>:null}{orgs.length>50?<Link className="underline" href={"/platform?q="+encodeURIComponent(q)+"&p="+(page+1)}>Next</Link>:null}</div>
 <p className="text-xs text-slate-500">Stored plan labels are operational records. Open a workspace to verify current Stripe subscription status.</p></>;
}

import Link from "next/link";
import {connection} from "next/server";
import {requirePlatformAdmin} from "@/lib/auth";
import {logoutAction} from "@/lib/actions";
export const instant=false;
export default async function PlatformLayout({children}:{children:React.ReactNode}){
 await connection();const user=await requirePlatformAdmin();
 return <div className="min-h-dvh bg-[#f4f7fa] text-[#14263d]"><header className="border-b bg-white px-4 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><div><p className="font-bold">RepPilot · Owner console</p><p className="text-xs text-slate-500">{user.email}</p></div><form action={logoutAction}><button className="min-h-11 rounded-xl border px-4">Sign out</button></form></div><nav aria-label="Owner navigation" className="mx-auto mt-3 flex max-w-6xl gap-2 overflow-x-auto text-sm">{[["/platform","Overview"],["/platform/revenue","Paying customers"],["/owner-security","Security"],["/platform/users","Users"],["/platform/operations","Operations"],["/platform/audit","Audit history"],["/platform/deletion-requests","Deletion requests"]].map(([href,label])=><Link key={href} href={href} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 hover:bg-emerald-50">{label}</Link>)}</nav></header><main className="mx-auto max-w-6xl space-y-5 px-4 py-6">{children}</main></div>;
}

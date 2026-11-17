import {connection} from "next/server";
import {requirePlatformAdmin} from "@/lib/auth";
import {prisma} from "@/lib/db";
export const instant=false;
export default async function Audit(){
 await connection();await requirePlatformAdmin();const logs=await prisma.auditLog.findMany({where:{action:{startsWith:"platform."}},select:{id:true,action:true,entityType:true,entityId:true,createdAt:true,metadata:true,actor:{select:{name:true,email:true}},organization:{select:{name:true}}},orderBy:{createdAt:"desc"},take:100});
 return <><h1 className="text-3xl font-bold">Administrative audit history</h1><p className="text-sm text-slate-500">Latest 100 platform changes. Customer visit notes and email bodies are not displayed here.</p><ul className="space-y-3">{logs.map(log=><li key={log.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="font-semibold">{log.action} · {log.organization.name}</p><p className="text-xs text-slate-500">{log.createdAt.toISOString()} · {log.actor?.email??"Former operator"}</p><p className="mt-2 text-sm">{String((log.metadata as {reason?:unknown}|null)?.reason??"")}</p></li>)}</ul>{!logs.length?<p>No administrative changes recorded yet.</p>:null}</>;
}

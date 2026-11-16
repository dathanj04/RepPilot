"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgAction } from "@/lib/actions";
export function OrganizationSettingsForm({children}:{children:React.ReactNode}) {
 const [pending,start]=useTransition();const [message,setMessage]=useState("");const [failed,setFailed]=useState(false);const router=useRouter();
 return <form className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200" onSubmit={event=>{event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);setMessage("");start(async()=>{try{const result=await updateOrgAction(data);setFailed(!result.ok);setMessage(result.ok?"Organization settings saved.":result.error);if(result.ok)router.refresh();}catch{setFailed(true);setMessage("Settings could not be saved. Please try again.");}});}}>
 <fieldset disabled={pending} className="contents">{children}</fieldset>
 <button className="h-11 rounded-xl bg-[#10263E] text-sm font-medium text-white disabled:opacity-60" type="submit" disabled={pending}>{pending?"Saving settings…":"Save organization settings"}</button>
 {message?<p role={failed?"alert":"status"} className={`rounded-xl p-3 text-sm ${failed?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-900"}`}>{message}</p>:null}
 </form>;
}

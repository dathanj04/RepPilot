"use client";
import {useActionState,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {cancelLunchAction,type CancellationState} from "@/lib/lunch-cancellation-actions";
export function CancelLunchForm({kind,id,email,hasOrder=false,cancelled=false,deliveryStatus,reason}:{kind:"booking"|"invitation";id:string;email:string;hasOrder?:boolean;cancelled?:boolean;deliveryStatus?:string;reason?:string}){
 const [state,action,pending]=useActionState<CancellationState,FormData>(cancelLunchAction,{});
 const [notify,setNotify]=useState(true);const router=useRouter();
 useEffect(()=>{if(state.cancelled)router.refresh();},[state.cancelled,router]);
 const done=cancelled||state.cancelled,status=state.deliveryStatus??deliveryStatus;
 return <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
 <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-red-800">{done?"Cancellation details":"Cancel "+(kind==="booking"?"lunch":"pending invitation")}</summary>
 {state.error?<p role="alert" className="mb-2 text-sm text-red-700">{state.error}</p>:null}
 {state.message?<p role="status" className="mb-2 text-sm">{state.message}</p>:null}
 {done?<><p className="text-sm">{reason}</p><p className="mt-2 text-xs text-slate-500">{status==="sent"?"Office email sent.":status==="not_requested"?"Office email was not requested.":"Office email has not been confirmed sent."}</p>
 {status!=="sent"&&status!=="not_requested"?<form action={action}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={id}/><input type="hidden" name="operation" value="retry"/><button disabled={pending} className="mt-3 min-h-11 rounded-xl border px-3 text-sm">{pending?"Sending…":"Retry cancellation email"}</button></form>:null}</>:
 <form action={action} className="space-y-3">
 <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={id}/>
 <label className="block text-sm">Reason for cancellation<textarea name="reason" required minLength={5} maxLength={1000} rows={3} placeholder="Explain why the lunch is being canceled. This reason will be included in the office email." className="mt-1 w-full rounded-xl border p-3 text-base"/></label>
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notifyOffice" value="yes" checked={notify} onChange={e=>setNotify(e.target.checked)}/>Email the office</label>
 {notify?<label className="block text-sm">Office email<input type="email" name="recipientEmail" defaultValue={email} required maxLength={254} className="mt-1 min-h-11 w-full rounded-xl border px-3 text-base"/></label>:null}
 {hasOrder?<label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" name="externalOrderAcknowledged" value="yes" required className="mt-1"/>I understand that RepPilot does not cancel the catering vendor’s order. I will contact the vendor separately.</label>:null}
 <p className="text-xs text-slate-500">This removes the lunch from pending lists and cancels its booking links and future reminders. A cancellation record is kept in history.</p>
 <button disabled={pending} className="min-h-11 w-full rounded-xl bg-red-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{pending?"Canceling…":notify?"Cancel & email office":"Cancel without email"}</button>
 </form>}
 </details>;
}

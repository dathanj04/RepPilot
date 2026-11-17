"use client";
import {useActionState,useState,useEffect} from "react";
import {platformChangeAction,type PlatformState} from "@/lib/platform/actions";
export function PlatformChangeForm({kind,id,value,label,roles=false}:{kind:string;id:string;value:string;label:string;roles?:boolean}){
 const [state,action,pending]=useActionState<PlatformState,FormData>(platformChangeAction,{});
 const [reason,setReason]=useState(""),[password,setPassword]=useState(""),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{if(state.message){setPassword("");setConfirmed(false);}},[state.message]);
 return <details className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer py-2 font-medium">{label}</summary>
 <form action={action} className="mt-3 grid gap-3">
 <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={id}/>
 {roles?<label>Organization role<select name="value" defaultValue={value} className="block min-h-11 w-full rounded-lg border p-2">{["REP","MANAGER","COMPLIANCE_ADMIN","ORG_ADMIN"].map(r=><option key={r}>{r}</option>)}</select></label>:<input type="hidden" name="value" value={value}/>}
 <label>Reason<textarea value={reason} onChange={e=>setReason(e.target.value)} name="reason" minLength={10} maxLength={1000} required className="block w-full rounded-lg border p-2"/></label>
 <label>Your current password<input value={password} onChange={e=>setPassword(e.target.value)} name="password" type="password" required autoComplete="current-password" className="block min-h-11 w-full rounded-lg border p-2"/></label>
 <label className="flex items-start gap-2"><input checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} type="checkbox" name="confirmed" value="yes" required className="mt-1"/>I confirm this change.</label>
 {state.error?<p role="alert" className="text-red-700">{state.error}</p>:null}{state.message?<p role="status" className="text-emerald-800">{state.message}</p>:null}
 <button disabled={pending} className="min-h-11 rounded-lg bg-[#10263E] p-2 font-semibold text-white disabled:opacity-50">{pending?"Saving…":"Confirm change"}</button>
 </form></details>;
}

"use client";
import {useEffect,useTransition} from "react";
import {useRouter} from "next/navigation";
export function BillingRefresh(){
 const router=useRouter(),[pending,start]=useTransition();
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==="visible")router.refresh();};
  document.addEventListener("visibilitychange",refresh);window.addEventListener("focus",refresh);
  return ()=>{document.removeEventListener("visibilitychange",refresh);window.removeEventListener("focus",refresh);};
 },[router]);
 return <button type="button" disabled={pending} onClick={()=>start(()=>router.refresh())} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium disabled:opacity-50">{pending?"Checking…":"Refresh subscription status"}</button>;
}

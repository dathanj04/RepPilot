"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LunchAlerts({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(()=>{
    let stopped=false, busy=false;
    const seen=new Set<string>();
    async function check() {
      if (busy || document.visibilityState !== "visible") return;
      busy=true;
      try {
        const response=await fetch('/api/notifications/lunch',{cache:'no-store'});
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
        const data=await response.json() as {lunches:{id:string;name:string;startsAt:string}[]};
        if(stopped) return;
        let changed=false;
        for(const lunch of data.lunches){
          const key=`reppilot:lunch-approval:${userId}:${lunch.id}`;
          if(seen.has(key))continue;
          seen.add(key);
          try{if(sessionStorage.getItem(key))continue;sessionStorage.setItem(key,'1');}catch{}
          changed=true;
          toast('Lunch approval needed',{id:key,description:`${lunch.name} accepted a time: ${new Date(lunch.startsAt).toLocaleString()}. Review and approve the lunch.`,duration:15000,action:{label:'Review lunch',onClick:()=>router.push(`/lunches/${encodeURIComponent(lunch.id)}`)}});
        }
        if(changed)router.refresh();
      }catch{/* The persistent Alerts inbox remains available if polling fails. */}
      finally{busy=false;}
    }
    void check();
    const timer=setInterval(()=>void check(),30000);
    const visible=()=>void check();
    document.addEventListener('visibilitychange',visible);
    return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[router,userId]);
  return null;
}

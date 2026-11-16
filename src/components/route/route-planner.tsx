"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, GripVertical, LockKeyhole, Trash2, Copy, Navigation, Sparkles, Map as MapIcon, Pencil } from "lucide-react";
import { evaluatePlanningAction, savePlanningAction, deletePlanningAction, geocodeRoutePointAction, planningToCalendarAction } from "@/lib/route-planning-actions";
import { planningSchema, type RoutePlanning, type RoutePoint, type PlannedStop, type RoadResult, type SavedPlanning } from "@/lib/domain/route-planning";
import { directionsUrl } from "@/lib/domain/distance";

export type PlannerOffice = {id:string;name:string;address:string;lat:number|null;lng:number|null;lastVisit:string|null;lastReferral:string|null;nextFollowUp:string|null;crm:string;tasks:string[];topic:string|null};
type Saved = {id:string;updatedAt:string;name:string;date:string;planning:SavedPlanning|null;legacy:{accountId:string;name:string;address:string;lat:number|null;lng:number|null}[]};
type Draft = {id:string|null;updatedAt:string|null;name:string;departure:string;workEnd:string;breakStart:string;breakEnd:string;start:RoutePoint|null;end:RoutePoint|null;stops:PlannedStop[]};
const field="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const button="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium disabled:opacity-40";
const local=(value:string)=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const point=(o:PlannerOffice):RoutePoint|null=>o.lat==null||o.lng==null?null:{key:o.id,accountId:o.id,name:o.name,address:o.address,lat:o.lat,lng:o.lng};
const stop=(p:RoutePoint):PlannedStop=>({...p,minutes:30,locked:false,appointment:null});
function fromSaved(r:Saved):Draft {
  const p=r.planning;
  const departure=p?.departure??r.date, day=local(departure).slice(0,10);
  const stops=p?.stops??r.legacy.flatMap(o=>o.lat==null||o.lng==null?[]:[stop({key:o.accountId,accountId:o.accountId,name:o.name,address:o.address,lat:o.lat,lng:o.lng})]);
  return {id:r.id,updatedAt:r.updatedAt,name:p?.name??r.name,departure:local(departure),workEnd:p?local(p.workEnd):day+"T18:00",breakStart:p?.breakStart?local(p.breakStart):"",breakEnd:p?.breakEnd?local(p.breakEnd):"",start:p?.start??stops[0]??null,end:p?.end??null,stops};
}
function toPlan(d:Draft):RoutePlanning {
  return planningSchema.parse({version:1,name:d.name,departure:new Date(d.departure).toISOString(),workEnd:new Date(d.workEnd).toISOString(),breakStart:d.breakStart?new Date(d.breakStart).toISOString():null,breakEnd:d.breakEnd?new Date(d.breakEnd).toISOString():null,start:d.start,end:d.end,stops:d.stops});
}

export function RoutePlanner({userId,timezone,workStart,workEnd,offices,routes,requestedRoute,addAccountId}:{userId:string;timezone:string;workStart:string;workEnd:string;offices:PlannerOffice[];routes:Saved[];requestedRoute:string|null;addAccountId:string|null}) {
  const today=local(new Date().toISOString()).slice(0,10);
  const blank=():Draft=>({id:null,updatedAt:null,name:"My route",departure:today+"T"+workStart,workEnd:today+"T"+workEnd,breakStart:"",breakEnd:"",start:null,end:null,stops:[]});
  const [draft,setDraft]=useState<Draft>(blank);
  const [saved,setSaved]=useState(routes);
  const [tab,setTab]=useState<"current"|"saved">("current");
  const [adding,setAdding]=useState(false);
  const [target,setTarget]=useState<"stop"|"start"|"end">("stop");
  const [search,setSearch]=useState("");
  const [address,setAddress]=useState("");
  const [road,setRoad]=useState<RoadResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [ready,setReady]=useState(false);
  const [savedClean,setSavedClean]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const revision=useRef(0);
  const dragging=useRef<number|null>(null);
  const [dragIndex,setDragIndex]=useState<number|null>(null);
  const storageKey="reppilot-route-draft-v1:"+userId;
  const refs=useRef({offices,routes,requestedRoute,addAccountId});
  refs.current={offices,routes,requestedRoute,addAccountId};
  useEffect(()=>{
    revision.current++;
    const {routes,offices,requestedRoute,addAccountId}=refs.current;
    let value:Draft=blank();
    try {const cached=JSON.parse(localStorage.getItem(storageKey)||"null") as Draft|null;if(cached&&Array.isArray(cached.stops)&&cached.stops.length<=20&&typeof cached.departure==="string") value=cached;} catch {}
    const selected=requestedRoute?routes.find(r=>r.id===requestedRoute):null;
    if(selected) value=fromSaved(selected);
    if(addAccountId){const office=offices.find(o=>o.id===addAccountId),p=office?point(office):null;if(p&&!value.stops.some(s=>s.accountId===addAccountId)&&value.stops.length<20){value={...value,start:value.start??p,stops:[...value.stops,stop(p)]};}}
    setDraft(value);setRoad(selected?.planning?.road??null);setSavedClean(Boolean(selected&&!addAccountId));setReady(true);
    // Initial request and draft restoration happen once; subsequent edits stay in client state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storageKey,requestedRoute,addAccountId]);
  useEffect(()=>{if(ready)try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{setMessage("Device draft storage is unavailable. Save the route to keep it.");}},[draft,ready,storageKey]);
  function update(next:Draft){revision.current++;setDraft(next);setRoad(null);setSavedClean(false);setMessage("");}
  const signature=JSON.stringify(draft);
  useEffect(()=>{
    if(!ready||!draft.start||!draft.stops.length)return;
    const current=revision.current;
    const timer=setTimeout(()=>{let p:RoutePlanning;try{p=toPlan(draft);}catch{return;}
      evaluatePlanningAction(p).then(result=>{if(current!==revision.current)return;if("error" in result){setMessage(result.error);setRoad(null);}else{setRoad(result.value.road);
          const constraints=result.value.plan.stops;
          if(JSON.stringify(constraints)!==JSON.stringify(draft.stops))setDraft(current=>({...current,stops:constraints}));
        }}).catch(()=>{if(current===revision.current){setMessage("Driving estimates are unavailable. Your draft is retained.");setRoad(null);}});
    },900);
    return ()=>clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature,ready]);
  const time=(iso:string)=>new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:timezone});
  function add(p:RoutePoint){if(target==="start")update({...draft,start:p});else if(target==="end")update({...draft,end:p});else{if(draft.stops.length>=20){setMessage("This planner supports up to 20 offices.");return;}if(draft.stops.some(s=>s.key===p.key)){setMessage("That office is already in this route.");return;}update({...draft,start:draft.start??p,stops:[...draft.stops,stop(p)]});}setAdding(false);setSearch("");setAddress("");}
  function move(from:number,to:number){
    if(from===to||to<0||to>=draft.stops.length)return;
    const low=Math.min(from,to),high=Math.max(from,to);
    if(draft.stops.slice(low,high+1).some(s=>s.locked||s.appointment)){setMessage("Unlock stops or remove fixed times before moving visits across them.");return;}
    const stops=[...draft.stops], [item]=stops.splice(from,1);stops.splice(to,0,item);update({...draft,stops});
  }
  async function optimize(){
    setBusy(true);setMessage("");
    try{const result=await evaluatePlanningAction(toPlan(draft),true);if("error" in result){setMessage(result.error);return;}revision.current++;setDraft({...draft,stops:result.value.plan.stops});setRoad(result.value.road);setSavedClean(false);setMessage("Road order optimized around locked and fixed-time stops. You can still edit it.");}
    catch{setMessage("Review your start, date, departure time and stops.");}finally{setBusy(false);}
  }
  async function save(){
    setBusy(true);setMessage("");
    try{const result=await savePlanningAction(toPlan(draft),draft.id,draft.updatedAt);if("error"in result){setMessage(result.error);return;}
      const next={...draft,id:result.id,updatedAt:result.updatedAt,stops:result.planning.stops};setDraft(next);setRoad(result.planning.road??null);setSavedClean(true);
      setSaved(current=>[{id:result.id,updatedAt:result.updatedAt,name:next.name,date:result.planning.departure,planning:result.planning,legacy:[]},...current.filter(r=>r.id!==result.id)]);setMessage("Route saved to your account.");
    }catch{setMessage("Review the route fields before saving.");}finally{setBusy(false);}
  }
  function open(r:Saved){revision.current++;setDraft(fromSaved(r));setRoad(r.planning?.road??null);setSavedClean(true);setTab("current");setMessage("");}
  async function calendar(){if(!draft.id||!savedClean){setMessage("Save your latest route changes first.");return;}setBusy(true);try{const r=await planningToCalendarAction(draft.id);setMessage("error"in r?r.error:"Visits added to your RepPilot calendar. Existing lunch events were preserved.");}catch{setMessage("Calendar could not be updated.");}finally{setBusy(false);}}
  async function geocode(){setBusy(true);try{const r=await geocodeRoutePointAction(address);if("error"in r)setMessage(r.error);else add(r.point);}catch{setMessage("Address search failed.");}finally{setBusy(false);}}
  function suggest(){
    const ordered=offices.filter(o=>point(o)).sort((a,b)=>{
      const score=(o:PlannerOffice)=>(o.nextFollowUp&&Date.parse(o.nextFollowUp)<Date.now()?1000:0)+o.tasks.length*20+(o.lastVisit?Math.min(180,(Date.now()-Date.parse(o.lastVisit))/86400000):180);
      return score(b)-score(a);
    }).slice(0,16).map(o=>stop(point(o)!));
    update({...draft,start:draft.start??ordered[0]??null,stops:ordered});setMessage("Suggested from overdue follow-ups and recorded engagement. Tap Optimize for road efficiency; this is a record-based suggestion, not a prediction.");
  }
  function touchMove(event:React.PointerEvent<HTMLButtonElement>){
    if(dragging.current==null)return;
    const elements=document.elementsFromPoint(event.clientX,event.clientY);
    const row=elements.map(e=>e.closest<HTMLElement>("[data-stop-index]")).find(Boolean);
    if(row){const index=Number(row.dataset.stopIndex);if(Number.isInteger(index))setDragIndex(index);}
  }
  const first=draft.stops[0];
  const navigation=first?directionsUrl({lat:first.lat,lng:first.lng}):null;
  return <div className="route-workspace mx-auto max-w-3xl px-4 pt-4 pb-36">
    <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-semibold">Routes</h1><Link href="/map" className={button}><MapIcon className="size-4"/>Map</Link></div>
    <div role="tablist" aria-label="Route views" className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200/70 p-1">
      {(["current","saved"]as const).map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)} className={"min-h-11 rounded-lg text-sm font-semibold "+(tab===t?"bg-white shadow-sm":"text-slate-500")}>{t==="current"?"Current Route":"Saved Routes"}</button>)}
    </div>
    {message?<p role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">{message}</p>:null}
    {tab==="saved"?<section aria-label="Saved routes" className="space-y-3">
      <button className={button+" w-full"} onClick={()=>{update(blank());setTab("current");}}>+ Create Route</button>
      {saved.length===0?<p className="p-6 text-center text-sm text-slate-500">Saved routes will appear here.</p>:null}
      {saved.map(r=><article key={r.id} className="rounded-2xl border bg-white p-4"><button className="min-h-11 w-full text-left font-semibold" onClick={()=>open(r)}>{r.name}</button><p className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()} · {r.planning?.stops.length??r.legacy.length} stops</p><div className="mt-3 flex gap-2">
        <button className={button} onClick={()=>open(r)}>Open</button>
        <button aria-label={"Duplicate "+r.name} className={button} onClick={()=>{const d=fromSaved(r);update({...d,id:null,updatedAt:null,name:d.name+" copy"});setTab("current");}}><Copy className="size-4"/>Duplicate</button>
        <button aria-label={"Delete "+r.name} className={button} disabled={busy} onClick={async()=>{if(!confirm("Delete this saved route?"))return;setBusy(true);try{const result=await deletePlanningAction(r.id);if("error"in result)setMessage(result.error);else{setSaved(v=>v.filter(x=>x.id!==r.id));if(draft.id===r.id)update(blank());}}catch{setMessage("Route could not be deleted.");}finally{setBusy(false);}}}><Trash2 className="size-4"/></button>
      </div></article>)}
    </section>:<><fieldset disabled={busy} className="contents">
      <button className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#19B78A] text-base font-semibold text-[#06281f]" disabled={busy} onClick={()=>{setTarget("stop");setAdding(v=>!v);}}><Plus className="size-5"/>Add Location</button>
      {adding?<section aria-label="Add location" className="mb-4 space-y-3 rounded-2xl border bg-white p-3">
        <div className="flex justify-between"><h2 className="font-semibold">{target==="stop"?"Add visit":target==="start"?"Starting location":"Ending location"}</h2><button className="min-h-11 px-3" onClick={()=>setAdding(false)}>Close</button></div>
        <input className={field} aria-label="Search saved accounts" placeholder="Search saved accounts" value={search} onChange={e=>setSearch(e.target.value)}/>
        <ul className="max-h-52 overflow-y-auto">{offices.filter(o=>o.name.toLowerCase().includes(search.toLowerCase())).slice(0,100).map(o=><li key={o.id}><button className="min-h-11 w-full border-b py-2 text-left text-sm disabled:text-slate-400" disabled={!point(o)||busy} onClick={()=>add(point(o)!)}>{o.name}{!point(o)?" · needs coordinates":""}</button></li>)}</ul>
        <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void geocode();}}><input className={field} aria-label="Search street address" placeholder="Street address, city, state" value={address} onChange={e=>setAddress(e.target.value)} required/><button disabled={busy} className={button}>Find</button></form>
        {target!=="stop"?<button className={button} disabled={busy} onClick={()=>{if(!navigator.geolocation){setMessage("Location is unavailable. Enter an address.");return;}setBusy(true);navigator.geolocation.getCurrentPosition(p=>{add({key:"device",accountId:null,name:"My location",address:"Device location",lat:p.coords.latitude,lng:p.coords.longitude});setBusy(false);},()=>{setMessage("Location access failed. Enter an address instead.");setBusy(false);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});}}>Use my location</button>:null}
      </section>:null}
      <section className="mb-4 space-y-3 rounded-2xl border bg-white p-4">
        <label className="block text-xs font-medium">Route name<input className={field+" mt-1"} value={draft.name} onChange={e=>update({...draft,name:e.target.value})}/></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs">Date & departure<input type="datetime-local" className={field+" mt-1"} value={draft.departure} onChange={e=>{const value=e.target.value,day=value.slice(0,10),previous=draft.departure.slice(0,10);const shift=(date:string)=>value&&date.startsWith(previous+"T")?day+date.slice(10):date;update({...draft,departure:value,workEnd:shift(draft.workEnd),breakStart:shift(draft.breakStart),breakEnd:shift(draft.breakEnd)});}}/></label><label className="text-xs">Working hours end<input type="datetime-local" className={field+" mt-1"} value={draft.workEnd} onChange={e=>update({...draft,workEnd:e.target.value})}/></label></div>
        <p className="text-xs text-slate-500">Inputs use this device’s time zone. Arrival times display in {timezone}.</p>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-slate-500">Start</p><p className="truncate text-sm font-medium">{draft.start?.name??"Choose a starting location"}</p></div><button className={button} onClick={()=>{setTarget("start");setAdding(true);}}>Set start</button></div>
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">End location & lunch break</summary>
          <div className="space-y-2"><button className={button} onClick={()=>{setTarget("end");setAdding(true);}}>Set ending location</button>{draft.end?<div className="flex items-center justify-between text-sm">{draft.end.name}<button className={button} onClick={()=>update({...draft,end:null})}>Remove end</button></div>:<p className="text-xs text-slate-500">Ends at the final office. Optimization keeps that final office fixed.</p>}
          <label className="block text-xs">Lunch starts<input type="datetime-local" className={field} value={draft.breakStart} onChange={e=>update({...draft,breakStart:e.target.value})}/></label><label className="block text-xs">Lunch ends<input type="datetime-local" className={field} value={draft.breakEnd} onChange={e=>update({...draft,breakEnd:e.target.value})}/></label></div>
        </details>
      </section>
      <button className={button+" mb-4 w-full"} disabled={busy} onClick={suggest}><Sparkles className="size-4"/>Suggest My Route</button>
      <ol className="space-y-3" aria-label="Route stops">{draft.stops.map((s,i)=>{
        const o=offices.find(o=>o.id===s.accountId),timing=road?.timings.find(t=>t.key===s.key);
        return <li key={s.key} data-stop-index={i} className={"rounded-2xl border bg-white p-3 "+(dragIndex===i?"ring-2 ring-emerald-500":"")}>
          <div className="flex items-start gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">{i+1}</span><div className="min-w-0 flex-1"><p className="font-semibold">{s.name}</p><p className="mt-1 text-xs text-slate-500">{timing?time(timing.arrival):"Calculating arrival…"} · {s.minutes} min visit</p><p className="mt-1 text-xs text-slate-500">{timing?Math.ceil(timing.travelSeconds/60)+" min driving from "+(i?"previous office":"start"):"Driving time unavailable"}</p></div>
            <button className="grid size-11 shrink-0 touch-none place-items-center rounded-xl bg-slate-50" aria-label={"Drag to reorder "+s.name} disabled={busy||s.locked||!!s.appointment}
              onPointerDown={e=>{dragging.current=i;setDragIndex(i);e.currentTarget.setPointerCapture(e.pointerId);}}
              onPointerMove={touchMove} onPointerUp={()=>{if(dragging.current!=null&&dragIndex!=null)move(dragging.current,dragIndex);dragging.current=null;setDragIndex(null);}}
              onPointerCancel={()=>{dragging.current=null;setDragIndex(null);}}><GripVertical className="size-5"/></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={button} aria-label={"Move "+s.name+" up"} disabled={busy||i===0} onClick={()=>move(i,i-1)}>↑</button><button className={button} aria-label={"Move "+s.name+" down"} disabled={busy||i===draft.stops.length-1} onClick={()=>move(i,i+1)}>↓</button>
            <button className={button} onClick={()=>setEditing(editing===s.key?null:s.key)}><Pencil className="size-4"/>Edit</button>
            <button className={button} aria-pressed={s.locked} onClick={()=>update({...draft,stops:draft.stops.map(t=>t.key===s.key?{...t,locked:!t.locked}:t)})}><LockKeyhole className="size-4"/>{s.locked?"Locked":"Lock"}</button>
            <button className={button} aria-label={"Remove "+s.name} onClick={()=>update({...draft,stops:draft.stops.filter(t=>t.key!==s.key)})}><Trash2 className="size-4"/></button>
          </div>
          {editing===s.key?<div className="mt-3 grid gap-2"><label className="text-xs">Visit duration (minutes)<input className={field} type="number" min={5} max={480} value={s.minutes} onChange={e=>update({...draft,stops:draft.stops.map(t=>t.key===s.key?{...t,minutes:Number(e.target.value)}:t)})}/></label><label className="text-xs">Fixed appointment (optional)<input className={field} type="datetime-local" value={s.appointment?local(s.appointment):""} onChange={e=>update({...draft,stops:draft.stops.map(t=>t.key===s.key?{...t,appointment:e.target.value?new Date(e.target.value).toISOString():null}:t)})}/></label></div>:null}
          <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm">Address & visit preparation</summary><p className="text-sm">{s.address}</p>{o?<div className="mt-3 space-y-2 text-xs text-slate-600">
            <p>Last visit: {o.lastVisit?new Date(o.lastVisit).toLocaleDateString():"Not recorded"}</p><p>Last referral: {o.lastReferral?new Date(o.lastReferral).toLocaleDateString():"Not available"}</p><p>CRM: {o.crm}</p><p>Follow-ups: {o.tasks.length?o.tasks.join(" · "):"None recorded"}</p><p>Suggested conversation: {o.topic??"No recorded suggestion yet. Open the account’s visit brief."}</p>
            <Link className={button} href={"/accounts/"+o.id}>Open account</Link><Link className={button} href={"/accounts/"+o.id+"/check-in"}>Check in</Link><Link className={button} href={"/lunches/new?account="+o.id}>Schedule lunch</Link>
          </div>:null}</details>
        </li>;
      })}</ol>
      {!draft.stops.length?<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">Create your route by adding offices above or selecting map pins. Up to 20 visits per route.</div>:null}
      {road?<section className="mt-4 rounded-2xl bg-[#10263E] p-4 text-white"><h2 className="font-semibold">Route totals</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p>{Math.ceil(road.durationSeconds/60)} min driving</p><p>{(road.distanceMeters/1609.344).toFixed(1)} miles</p><p>{Math.round(road.visitSeconds/60)} min visits</p><p>Finish {time(road.completedAt)}</p></div><p className="mt-3 text-xs text-slate-300">TomTom road estimates with traffic. Times may change during the day.</p>{road.warnings.map(w=><p key={w} role="alert" className="mt-2 text-sm text-amber-200">{w}</p>)}</section>:null}
      {draft.id&&savedClean?<Link className={button+" mt-3 w-full"} href={"/map?route="+draft.id}>View numbered route on map</Link>:null}
      <div className="route-action-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-1 border-t bg-white/95 px-2 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] shadow-lg md:left-64">
        {navigation?<a className="grid min-h-12 place-items-center rounded-xl bg-[#19B78A] text-xs font-bold text-[#06281f]" href={navigation} target="_blank" rel="noreferrer"><Navigation className="size-4"/>GO</a>:<button disabled className={button}>GO</button>}
        <button className={button+" px-1 text-[10px]"} disabled={busy||draft.stops.length<2} onClick={()=>void optimize()}>OPTIMIZE</button>
        <button className={button+" px-1 text-[10px]"} disabled={busy||!draft.stops.length} onClick={()=>void save()}>{busy?"WAIT":"SAVE"}</button>
        <button className={button+" px-1 text-[10px]"} disabled={busy} onClick={()=>{if(confirm("Clear this draft? Saved routes are kept."))update(blank());}}>CLEAR</button>
        <button className={button+" px-1 text-[10px]"} disabled={busy||!savedClean} onClick={()=>void calendar()}>CALENDAR</button>
      </div>
    </fieldset></>}
  </div>;
}

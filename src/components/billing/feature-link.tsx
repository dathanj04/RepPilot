"use client";
import Link from "next/link";
import {useId,useState} from "react";
import {BUSINESS_UPGRADE} from "@/lib/domain/paid-access";
export function BusinessFeatureLink({href,locked,children,className}:{href:string;locked:boolean;children:React.ReactNode;className?:string}){
 const [open,setOpen]=useState(false),id=useId();
 if(!locked)return <Link href={href} className={className}>{children}</Link>;
 return <span className="group relative block"><button type="button" aria-disabled="true" aria-describedby={id} title={BUSINESS_UPGRADE} onClick={()=>setOpen(v=>!v)} className={(className??"")+" w-full cursor-pointer opacity-45"}>{children}</button>
 <span id={id} role="note" className={(open?"block":"hidden group-hover:block group-focus-within:block")+" fixed inset-x-4 bottom-24 z-[100] rounded-xl bg-[#10263E] p-3 text-left text-xs font-normal text-white shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:w-64"}>{BUSINESS_UPGRADE}<Link href="/billing?upgrade=business" className="mt-2 block min-h-9 py-2 font-semibold text-[#b5f4dd] underline">View Business plans</Link></span></span>;
}

import {escapeHtml} from "./templates";
export type CancellationDetails={
 kind:"booking"|"invitation";targetId:string;ownerId:string;office:string;recipientEmail:string;reason:string;
 rep:string;repEmail:string;location:string;notifyOffice:boolean;startsAt:string|null;endsAt:string|null;timezone:string;
};
const escape=(s:string)=>s.replace(/\\/g,"\\\\").replace(/\r\n|\r|\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
const stamp=(s:string)=>new Date(s).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
export function cancellationMessage(details:CancellationDetails,createdAt:Date){
 const when=details.startsAt?new Intl.DateTimeFormat("en-US",{dateStyle:"full",timeStyle:"short",timeZone:details.timezone}).format(new Date(details.startsAt))+" ("+details.timezone+")":"The offered times on the pending invitation";
 const text=["Your "+(details.kind==="booking"?"Lunch & Learn":"Lunch & Learn invitation")+" has been canceled.","","Office: "+details.office,"When: "+when,"","Reason: "+details.reason,"","Please do not use the previous booking or confirmation link.","If you would like to arrange another time, reply to "+details.rep+" at "+details.repEmail+".","Catering orders must be managed separately with the vendor."].join("\n");
 const subject=("Lunch & Learn canceled — "+details.office).replace(/[\r\n]/g," ").slice(0,200);
 const attachments=details.kind==="booking"&&details.startsAt&&details.endsAt?[{filename:"RepPilot-Lunch-Canceled.ics",content:Buffer.from([
 "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//RepPilot//Lunch and Learn//EN","METHOD:CANCEL","BEGIN:VEVENT",
 "UID:"+encodeURIComponent(details.targetId)+"@reppilot.app","DTSTAMP:"+stamp(createdAt.toISOString()),"DTSTART:"+stamp(details.startsAt),"DTEND:"+stamp(details.endsAt),"SEQUENCE:3","STATUS:CANCELLED","SUMMARY:"+escape("Canceled: Lunch & Learn — "+details.office),"DESCRIPTION:"+escape(details.reason),"END:VEVENT","END:VCALENDAR",""
 ].join("\r\n")).toString("base64"),content_type:"text/calendar; charset=utf-8; method=CANCEL"}]:[];
 return {subject,text,html:text.split("\n").filter(Boolean).map(line=>"<p>"+escapeHtml(line)+"</p>").join(""),attachments};
}

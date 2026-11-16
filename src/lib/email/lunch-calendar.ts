import { escapeHtml } from "./templates";

type LunchDetails={id:string;office:string;location:string;rep:string;repEmail:string;organization:string;purpose:string;attendees:number;startsAt:Date;endsAt:Date;createdAt:Date;timezone:string;confirmed:boolean};
const escape=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const utc=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
function fold(line:string){const lines:string[]=[];let current='';for(const char of line){if(Buffer.byteLength(current+char)>75){lines.push(current);current=' '+char;}else current+=char;}lines.push(current);return lines.join('\r\n');}
export function lunchCalendar(input:LunchDetails){
 const description=`${input.purpose}\nRepresentative: ${input.rep} (${input.repEmail})\nOrganization: ${input.organization}\nAttendees: ${input.attendees}`;
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RepPilot//Lunch and Learn//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${encodeURIComponent(input.id)}@reppilot.app`,`DTSTAMP:${utc(input.createdAt)}`,`DTSTART:${utc(input.startsAt)}`,`DTEND:${utc(input.endsAt)}`,`SEQUENCE:${input.confirmed?2:1}`,`SUMMARY:${escape(`Lunch & Learn — ${input.office}`)}`,`LOCATION:${escape(input.location)}`,`DESCRIPTION:${escape(description)}`,'STATUS:CONFIRMED','TRANSP:OPAQUE','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export function lunchConfirmationMessage(input:LunchDetails){
 const when=new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:input.timezone}).format(input.startsAt);
 const end=new Intl.DateTimeFormat('en-US',{timeStyle:'short',timeZone:input.timezone}).format(input.endsAt);
 const text=`Your Lunch & Learn is confirmed.\n\nOffice: ${input.office}\nWhen: ${when} – ${end} (${input.timezone})\nLocation: ${input.location}\nRepresentative: ${input.rep}\nContact: ${input.repEmail}\nAttendees: ${input.attendees}\nPurpose: ${input.purpose}\n\nAdd the attached calendar invitation to your calendar. For changes, contact your representative. Catering arrangements are handled separately.`;
 return {subject:`Lunch & Learn confirmed — ${input.office}`,text,html:`<h1>Lunch &amp; Learn confirmed</h1>${text.split('\n').filter(Boolean).map(line=>`<p>${escapeHtml(line)}</p>`).join('')}`};
}

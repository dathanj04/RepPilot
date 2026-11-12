const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const STORE='scheduling/v1.json';
const clean=(x,n=250)=>String(x||'').trim().slice(0,n);
const future=x=>Number.isFinite(Date.parse(x))&&Date.parse(x)>Date.now();
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
async function loadSchedule(env){const f=await env.BUCKET.get(STORE);return {data:f?JSON.parse(await new Response(f.body).text()):{links:[],requests:[],slots:[]},etag:f?.httpEtag};}
async function persistSchedule(env,data,etag){return env.BUCKET.put(STORE,JSON.stringify(data),{onlyIf:etag?{etagMatches:etag.replaceAll('"','')}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});}
export async function scheduling(request,env){try{
 const url=new URL(request.url),isProvider=url.pathname.startsWith('/api/provider/'),user=request.headers.get('oai-authenticated-user-id');
 if(!isProvider&&!user)return reply({error:'Sign in required'},401);
 if(!env.BUCKET)return reply({error:'Scheduling unavailable'},503);
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(request.method==='POST'&&!isProvider&&request.headers.get('Origin')!==url.origin)return reply({error:'Invalid origin'},403);
 let body={};if(request.method==='POST'){const raw=await request.text();if(raw.length>12000)return reply({error:'Request too large'},413);try{body=JSON.parse(raw);}catch{return reply({error:'Invalid request'},400);}}
 const {data,etag}=await loadSchedule(env);let result;
 const occupied=id=>data.requests.some(r=>r.slotId===id&&['Confirmed','Proposed'].includes(r.status));
 if(isProvider){const t=url.pathname.split('/')[3];if(!/^[a-f0-9]{64}$/.test(t||''))return reply({error:'Invalid invitation'},404);const link=data.links.find(l=>l.token===t&&!l.revoked);if(!link)return reply({error:'This invitation is no longer available'},404);
 const direct=Date.now()<link.directUntil&&!link.directUsed;
 const requests=data.requests.filter(r=>r.linkId===link.id);
 const slots=data.slots.filter(s=>s.owner===link.owner&&future(s.start)&&(!occupied(s.id)||requests.some(r=>r.slotId===s.id&&['Confirmed','Proposed'].includes(r.status))));
 if(request.method==='GET')return reply({practice:link.practice,rep:link.rep,directUntil:link.directUntil,direct,slots:slots.map(s=>({id:s.id,start:s.start})),requests:requests.map(r=>({id:r.id,status:r.status,start:r.start,purpose:r.purpose,foodPreferences:r.foodPreferences||'',dietaryRestrictions:r.dietaryRestrictions||'',note:r.note||''}))});
 if(body.action==='accept-proposal'){const r=requests.find(r=>r.id===body.id&&r.status==='Proposed');if(!r||!future(r.start))return reply({error:'Proposal no longer available'},409);r.status='Confirmed';result={message:'Lunch confirmed. It is now on the rep’s RepPilot calendar.',request:r};}
 else{const s=slots.find(s=>s.id===body.slotId);if(!s||occupied(s.id))return reply({error:'That time is no longer available. Please choose another.'},409);
 if(requests.some(r=>future(r.start)&&['Pending','Confirmed','Proposed'].includes(r.status)))return reply({error:'This link already has an active lunch request.'},409);
 if(!clean(body.contact)||!/^\S+@\S+\.\S+$/.test(clean(body.email))||!clean(body.purpose)||!Number.isInteger(body.attendees)||body.attendees<1||body.attendees>200)return reply({error:'Complete contact, email, topic and attendees (1–200).'},400);
 const r={id:crypto.randomUUID(),linkId:link.id,owner:link.owner,practiceId:link.practiceId,practice:link.practice,slotId:s.id,start:s.start,contact:clean(body.contact),email:clean(body.email),attendees:body.attendees,purpose:clean(body.purpose,1000),foodPreferences:clean(body.foodPreferences,1000),dietaryRestrictions:clean(body.dietaryRestrictions,1000),status:direct?'Confirmed':'Pending',createdAt:new Date().toISOString()};data.requests.push(r);if(direct)link.directUsed=true;result={message:direct?'Lunch booked. It is now on the rep’s RepPilot calendar.':'Request sent. Your rep will review it. Return to this link to check the status.',request:{id:r.id,status:r.status,start:r.start}};}
 }else{
 if(request.method==='GET')return reply({portal:env.PROVIDER_PORTAL_URL||'',links:data.links.filter(l=>l.owner===user).map(l=>({...l,url:(env.PROVIDER_PORTAL_URL||'')+'/#'+l.token})),slots:data.slots.filter(s=>s.owner===user),requests:data.requests.filter(r=>r.owner===user)});
 if(body.action==='slot'){const start=clean(body.start);if(!future(start)||Date.parse(start)>Date.now()+366*86400000)return reply({error:'Choose a future time within one year.'},400);if(data.slots.some(s=>s.owner===user&&Math.abs(Date.parse(s.start)-Date.parse(start))<3600000))return reply({error:'Lunch slots must be at least an hour apart.'},409);data.slots.push({id:crypto.randomUUID(),owner:user,start:new Date(start).toISOString()});result={message:'Availability added'};}
 else if(body.action==='link'){const f=await env.BUCKET.get('workspaces/'+encodeURIComponent(user)+'.json');const ws=f?JSON.parse(await new Response(f.body).text()).state:null;const p=ws?.practices?.find(p=>p.id===body.practiceId);if(!p)return reply({error:'Save the practice to your workspace first.'},400);const l={id:crypto.randomUUID(),owner:user,practiceId:p.id,practice:p.name,rep:clean(ws.settings?.name||'Your representative'),token:token(),createdAt:new Date().toISOString(),directUntil:Date.now()+86400000,directUsed:body.requestOnly===true,revoked:false};data.links.push(l);result={message:'Link created',url:env.PROVIDER_PORTAL_URL+'/#'+l.token};}
 else if(body.action==='revoke'){const l=data.links.find(l=>l.id===body.id&&l.owner===user);if(!l)return reply({error:'Link not found'},404);l.revoked=true;result={message:'Link disabled'};}
 else{const r=data.requests.find(r=>r.id===body.id&&r.owner===user);if(!r)return reply({error:'Request not found'},404);
 if(body.action==='approve'){if(r.status!=='Pending'||!future(r.start)||occupied(r.slotId))return reply({error:'That request or time is no longer available'},409);r.status='Confirmed';}
 else if(body.action==='decline'){if(r.status!=='Pending')return reply({error:'Only pending requests can be declined'},409);r.status='Declined';r.note=clean(body.note,500);}
 else if(body.action==='propose'){if(!['Pending','Proposed'].includes(r.status))return reply({error:'Request cannot be rescheduled'},409);const s=data.slots.find(s=>s.owner===user&&s.id===body.slotId);if(!s||!future(s.start)||occupied(s.id))return reply({error:'Choose an available time'},409);r.slotId=s.id;r.start=s.start;r.status='Proposed';r.note=clean(body.note,500);}
 else if(body.action==='cancel'){if(!['Confirmed','Proposed'].includes(r.status))return reply({error:'Lunch cannot be cancelled'},409);r.status='Cancelled';r.note=clean(body.note,500);}
 else return reply({error:'Unknown action'},400);result={message:'Request updated'};}
 }
 const saved=await persistSchedule(env,data,etag);return saved?reply(result):reply({error:'Another booking changed availability. Refresh and try again.'},409);
 }catch{return reply({error:'Scheduling unavailable. Please try again.'},503);}}

// Initiate account deletion without requiring an email or a call. Fulfillment is a support task.
export async function accountAPI(request,env){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'Sign in required'},401);
 if(!env.BUCKET)return json({error:'Account service unavailable'},503);
 if(request.method==='GET'&&new URL(request.url).searchParams.get('admin')==='1'){if(!env.TEAM_MANAGER_EMAIL||request.headers.get('oai-authenticated-user-email')?.toLowerCase()!==env.TEAM_MANAGER_EMAIL.toLowerCase())return json({error:'Manager access required'},403);const listing=await env.BUCKET.list({prefix:'account-deletion/',limit:100});const requests=[];for(const item of listing.objects){const f=await env.BUCKET.get(item.key);if(f)requests.push({...JSON.parse(await new Response(f.body).text()),owner:decodeURIComponent(item.key.slice('account-deletion/'.length,-5))});}return json({requests,truncated:listing.truncated});}
 const key='account-deletion/'+encodeURIComponent(user)+'.json';
 if(request.method==='GET'){const f=await env.BUCKET.get(key);return json({request:f?JSON.parse(await new Response(f.body).text()):null});}
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
 const raw=await request.text();if(raw.length>1000)return json({error:'Request too large'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
 if(body.confirmation!=='DELETE')return json({error:'Type DELETE to confirm account deletion.'},400);
 const existing=await env.BUCKET.get(key);if(existing)return json({request:JSON.parse(await new Response(existing.body).text())});
 const record={email:request.headers.get('oai-authenticated-user-email')||null,id:crypto.randomUUID(),status:'requested',requestedAt:new Date().toISOString(),targetBy:new Date(Date.now()+30*86400000).toISOString()};
 const saved=await env.BUCKET.put(key,JSON.stringify(record),{onlyIf:{etagDoesNotMatch:'*'}});return saved?json({request:record},201):json({error:'A request was just submitted. Refresh the status.'},409);
}

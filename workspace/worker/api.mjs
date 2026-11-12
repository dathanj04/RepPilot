const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export async function workspace(request,env){
const user=request.headers.get('oai-authenticated-user-id');
if(!user)return json({error:'Sign in required'},401);
if(!env.BUCKET)return json({error:'Workspace storage unavailable'},503);
const key='workspaces/'+encodeURIComponent(user)+'.json';
if(request.method==='GET'){const file=await env.BUCKET.get(key);return file?new Response(file.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store',ETag:file.httpEtag}}):json({state:null},200,{ETag:'"new"'});}
if(request.method!=='PUT')return json({error:'Method not allowed'},405);
if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
if(Number(request.headers.get('Content-Length')||0)>8000000)return json({error:'Workspace too large'},413);
const raw=await request.text();if(raw.length>8000000)return json({error:'Workspace too large'},413);
let state;try{state=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
if(!state||!['practices','visits','tasks','route','lunches','referralLog'].every(k=>Array.isArray(state[k]))||!state.theme||!state.settings||state.practices.length>10000)return json({error:'Invalid workspace'},400);
const etag=request.headers.get('If-Match');if(!etag)return json({error:'Revision required'},428);
const onlyIf=etag==='"new"'?{etagDoesNotMatch:'*'}:{etagMatches:etag.replaceAll('"','')};
const file=await env.BUCKET.put(key,JSON.stringify({state}),{onlyIf,httpMetadata:{contentType:'application/json'}});
return file?json({saved:true},200,{ETag:file.httpEtag}):json({error:'Workspace changed. Reload before saving.'},409);
}

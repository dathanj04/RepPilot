import assert from 'node:assert/strict';import {teamAPI,crmAPI} from '../worker/team.mjs';
const records=new Map();const env={TEAM_MANAGER_EMAIL:'manager@example.test',BUCKET:{async get(k){const r=records.get(k);return r?{body:r.value,httpEtag:r.etag}:null;},async put(k,value,options={}){const old=records.get(k),c=options.onlyIf||{};if(c.etagDoesNotMatch==='*'&&old||c.etagMatches&&old?.etag!==`"${c.etagMatches}"`)return null;const etag='"'+crypto.randomUUID()+'"';records.set(k,{value,etag});return {httpEtag:etag};}}};
const req=(body,email='manager@example.test',user='manager')=>new Request('https://rep.test/api/team',{method:body?'POST':'GET',headers:{Origin:'https://rep.test',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':email}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function call(body,email,user){const r=await teamAPI(req(body,email,user),env);return {status:r.status,data:await r.json()};}
assert.equal((await call(null,'',null)).status,401);assert.equal((await call(null,'outsider@example.test','outsider')).status,403);
let d=(await call()).data;assert.equal(d.role,'manager');let r=await call({action:'rep',revision:d.revision,name:'Rep One',email:'rep@example.test',crmOwnerId:'owner-1'});assert.equal(r.status,200);d=r.data;const rep=d.reps[0];
r=await call({action:'upsert',revision:d.revision,accounts:[{id:'a',name:'Alpha',address:'123 Main St',lat:0,lng:0},{id:'b',name:'Beta',address:'456 Main St',lat:999,lng:1}]});assert.equal(r.status,200);d=r.data;assert.equal(d.accounts[0].lat,0);assert.equal(d.accounts[1].lat,null);
assert.equal((await call({action:'assign',revision:'"new"',ids:['a'],repId:rep.id})).status,409);
r=await call({action:'assign',revision:d.revision,ids:['a'],repId:rep.id});assert.equal(r.status,200);d=r.data;
let rd=(await call(null,'rep@example.test','rep')).data;assert.equal(rd.role,'rep');assert.deepEqual(rd.accounts.map(p=>p.id),['a']);assert.equal(rd.crm,undefined);
assert.equal((await call({action:'assign',revision:rd.revision,ids:['a'],repId:''},'rep@example.test','rep')).status,403);
assert.equal((await call({action:'upsert',revision:rd.revision,accounts:[{id:'b',name:'Beta changed'}]},'rep@example.test','rep')).status,403);
r=await call({action:'upsert',revision:rd.revision,accounts:[{id:'a',name:'Alpha updated',assignedRepId:''},{id:'c',name:'Gamma'}]},'rep@example.test','rep');assert.equal(r.status,200);assert.equal(r.data.accounts.length,2);assert.ok(r.data.accounts.every(p=>p.assignedRepId===rep.id));
d=(await call()).data;r=await call({action:'upsert',revision:d.revision,accounts:[{id:'different',name:'Alpha updated',address:'123 Main St'}]});assert.equal(r.status,200);assert.equal(r.data.accounts.length,3);
assert.equal((await crmAPI(req({source:'hubspot'}),env)).status,503);assert.equal((await crmAPI(req({source:'hubspot'},'rep@example.test','rep'),env)).status,403);
console.log('PASS: manager authorization, roster, bulk assignment, rep-only visibility, rep assignment denial, import ownership, duplicate merge, revisions and unconfigured CRM.');

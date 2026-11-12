import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const records=new Map();const env={STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_PRICE_BUSINESS_MONTHLY:'price_month',STRIPE_PRICE_BUSINESS_ANNUAL:'price_year',BUCKET:{async get(k){if(!records.has(k))return null;const text=records.get(k);return {etag:'v1',json:async()=>JSON.parse(text),text:async()=>text};},async put(k,v,o){if(o?.onlyIf?.etagDoesNotMatch&&records.has(k))return null;records.set(k,v);return {etag:'v1'};},async delete(k){records.delete(k);}}};
const req=(body,user='alice',origin='https://rep.test')=>new Request('https://rep.test/api/billing',{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:origin},...(body?{body:JSON.stringify(body)}:{})});
const get=async(body,user,origin)=>worker.fetch(req(body,user,origin),env);
let subscriptions=[],sessions=[],wrongPrice=false;const calls=[];
globalThis.fetch=async(url,opts={})=>{calls.push([url,opts]);const path=new URL(url).pathname;const p=new URLSearchParams(opts.body);let value;
if(path.includes('/prices/'))value={active:true,currency:'usd',unit_amount:wrongPrice?1:path.endsWith('price_year')?59160:5865,recurring:{interval:path.endsWith('price_year')?'year':'month',interval_count:1}};
else if(path.endsWith('/customers'))value={id:'cus_alice'};
else if(path.endsWith('/subscriptions'))value={data:subscriptions};
else if(path.endsWith('/checkout/sessions')){if(opts.method==='POST'){assert.equal(p.get('customer'),'cus_alice');assert.equal(p.get('line_items[0][price]'),'price_month');value={url:'https://checkout.stripe.com/test'};sessions=[value];}else value={data:sessions};}
else if(path.endsWith('/billing_portal/sessions')){assert.equal(p.get('customer'),'cus_alice');value={url:'https://billing.stripe.com/test'};}
else throw Error('Unexpected request '+url);return Response.json(value);};
assert.equal((await get(null,null)).status,401);
assert.equal((await get({action:'checkout',seats:1,interval:'monthly'},'alice','https://evil.test')).status,403);
assert.equal((await worker.fetch(req(),{})).status,200);
assert.equal((await worker.fetch(req({action:'checkout'}),{})).status,503);
assert.equal((await get({action:'checkout',seats:0,interval:'monthly'})).status,400);
wrongPrice=true;assert.equal((await get({action:'checkout',seats:1,interval:'monthly'})).status,503);wrongPrice=false;
assert.equal((await get({action:'checkout',seats:2,interval:'monthly'})).status,200);
assert.equal((await(await get({action:'checkout',seats:2,interval:'monthly'})).json()).resumed,true);
assert.equal(calls.filter(([u,o])=>u.endsWith('/checkout/sessions')&&o.method==='POST').length,1);
assert.equal((await get({action:'portal'})).status,200);
assert.equal((await get({action:'portal'},'bob')).status,409);
subscriptions=[{status:'active',items:{data:[]}}];assert.equal((await get({action:'checkout',seats:1,interval:'monthly'})).status,409);
assert.equal((await(await get()).json()).subscriptions[0].status,'active');
assert.equal((await(await get(null,'bob')).json()).customer,false);
assert.equal((await worker.fetch(new Request('https://rep.test/billing.js'),env)).status,200);
console.log('PASS: billing authentication, origin, disabled configuration, fixed prices, input validation, checkout reuse, subscription guard, customer isolation, portal and verified status.');

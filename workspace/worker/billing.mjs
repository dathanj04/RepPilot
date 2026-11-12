// Stripe credentials are runtime secrets. Billing never trusts browser-provided prices or customer IDs.
export async function billingAPI(request,env){
 if(request.method==='POST'&&/RepPilotNative\//.test(request.headers.get('User-Agent')||''))return json({error:'Purchases are not available in the mobile companion.'},403);
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'Sign in required'},401);
 const origin=new URL(request.url).origin;
 if(request.method!=='GET'&&request.headers.get('Origin')!==origin)return json({error:'Invalid origin'},403);
 const ready=!!(env.STRIPE_SECRET_KEY&&env.STRIPE_PRICE_BUSINESS_MONTHLY&&env.STRIPE_PRICE_BUSINESS_ANNUAL);
 if(!ready)return request.method==='GET'?json({ready:false,status:'not_connected'}):json({error:'Stripe is not connected yet.'},503);
 if(!env.BUCKET)return json({error:'Billing storage unavailable'},503);
 const stripe=async(path,params)=>{const r=await fetch('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':'2026-10-28.endive',...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:params?new URLSearchParams(params):undefined});const d=await r.json();if(!r.ok)throw new Error('Stripe could not complete this request. Please try again or contact support.');return d;};
 const key='billing/customer/'+encodeURIComponent(user)+'.json';
 const file=await env.BUCKET.get(key);let customer=file?await file.json():null;
 try{
 if(request.method==='GET'){
  const subscriptions=customer?(await stripe('subscriptions?customer='+encodeURIComponent(customer.id)+'&status=all&limit=100')).data:[];
  return json({ready:true,mode:env.STRIPE_SECRET_KEY.startsWith('sk_test_')?'test':'live',customer:!!customer,subscriptions:subscriptions.map(s=>({status:s.status,cancelAtPeriodEnd:s.cancel_at_period_end,items:s.items.data.map(i=>({seats:i.quantity,interval:i.price.recurring?.interval,amount:i.price.unit_amount,currency:i.price.currency}))}))});
 }
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const raw=await request.text();if(raw.length>2048)return json({error:'Request too large'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
 if(body.action!=='checkout'&&body.action!=='portal')return json({error:'Invalid billing action'},400);
 if(body.action==='portal'){
  if(!customer)return json({error:'No billing account exists yet.'},409);
  const portal=await stripe('billing_portal/sessions',{customer:customer.id,return_url:origin+'/#billing'});return json({url:portal.url});
 }
 if(!Number.isInteger(body.seats)||body.seats<1||body.seats>1000||!['monthly','annual'].includes(body.interval))return json({error:'Choose 1–1,000 seats and a billing interval.'},400);
 const priceId=body.interval==='annual'?env.STRIPE_PRICE_BUSINESS_ANNUAL:env.STRIPE_PRICE_BUSINESS_MONTHLY;
 const price=await stripe('prices/'+encodeURIComponent(priceId));
 if(!price.active||price.currency!=='usd'||price.unit_amount!==(body.interval==='annual'?59160:5865)||price.recurring?.interval!==(body.interval==='annual'?'year':'month')||price.recurring?.interval_count!==1)return json({error:'The Stripe price does not match RepPilot pricing. Contact support.'},503);
 if(!customer){
  // A stable idempotency key and conditional write prevent concurrent requests from selecting different customers.
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const r=await fetch('https://api.stripe.com/v1/customers',{method:'POST',headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':'2026-10-28.endive','Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'reppilot-customer-'+hash},body:new URLSearchParams({'metadata[reppilot_user]':user})});const d=await r.json();if(!r.ok)throw new Error('Unable to create billing account.');
  customer={id:d.id};const saved=await env.BUCKET.put(key,JSON.stringify(customer),{onlyIf:{etagDoesNotMatch:'*'}});if(!saved)customer=await(await env.BUCKET.get(key)).json();
 }
 const subscriptions=(await stripe('subscriptions?customer='+encodeURIComponent(customer.id)+'&status=all&limit=100')).data;
 if(subscriptions.some(s=>!['canceled','incomplete_expired'].includes(s.status)))return json({error:'A subscription already exists. Use Manage billing to change it.'},409);
 const sessions=(await stripe('checkout/sessions?customer='+encodeURIComponent(customer.id)+'&status=open&limit=100')).data;
 if(sessions.length)return json({url:sessions[0].url,resumed:true});
 // Per-customer lease also prevents overlapping checkout session creation.
 const lockKey=key+'.lock';const lock=await env.BUCKET.get(lockKey);if(lock&&Number(await lock.text())>Date.now())return json({error:'Checkout is opening. Please try again in a moment.'},409);
 const lease=await env.BUCKET.put(lockKey,String(Date.now()+30000),{onlyIf:lock?{etagMatches:lock.etag}:{etagDoesNotMatch:'*'}});if(!lease)return json({error:'Checkout is already opening.'},409);
 try{const existing=(await stripe('checkout/sessions?customer='+encodeURIComponent(customer.id)+'&status=open&limit=100')).data;if(existing.length)return json({url:existing[0].url,resumed:true});const checkout=await stripe('checkout/sessions',{mode:'subscription',customer:customer.id,'line_items[0][price]':priceId,'line_items[0][quantity]':String(body.seats),success_url:origin+'/?checkout=returned#billing',cancel_url:origin+'/#billing'});return json({url:checkout.url});}finally{await env.BUCKET.delete(lockKey);}
 }catch(err){return json({error:err.message||'Billing is temporarily unavailable.'},502);}
}

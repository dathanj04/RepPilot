// Test process only. Never load this file in a deployed server.
if(process.env.CI!=="true"||process.env.ROUTE_BROWSER_TEST!=="true"||!process.env.DATABASE_URL?.includes("@localhost:5432/route_test"))throw Error("Road fixtures are restricted to isolated CI.");
const realFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const raw=typeof input==="string"?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw);
 if(url.hostname==="api.stripe.com"){
  if(url.pathname==="/v1/subscriptions"&&!url.searchParams.has("customer")){
   const fixture=JSON.parse(require("node:fs").readFileSync("/tmp/route-browser-session.json","utf8"));
   const make=(id,org,customer,price,amount,interval)=>({id,customer:{id:customer,name:"Billing fixture",email:"billing@example.invalid"},status:"active",livemode:true,metadata:{organizationId:org},latest_invoice:{id:"in_"+id,status:"paid",amount_paid:amount,currency:"usd",status_transitions:{paid_at:Math.floor(Date.now()/1000)-60}},items:{data:[{current_period_end:Math.floor(Date.now()/1000)+86400,quantity:1,price:{id:price,unit_amount:amount,currency:"usd",recurring:{interval,interval_count:1}}}]}});
   const trial=make("sub_browser_trial",fixture.trialOrganizationId,"cus_browser_trial","price_1UcZG5AJxC2GoXaReqGuyGpO",4800,"month");Object.assign(trial,{status:"trialing",trial_end:Math.floor(Date.parse(fixture.trialEndsAt)/1000),default_payment_method:"pm_fixture",collection_method:"charge_automatically"});trial.latest_invoice.amount_paid=0;
   return Response.json({has_more:false,data:[trial,make("sub_business_report",fixture.organizationId,"cus_browser_business","price_1UcZG9AJxC2GoXaRLNovhZQD",48000,"year"),make("sub_individual_report",fixture.individualOrganizationId,"cus_browser_individual","price_1UcZGHAJxC2GoXaRGEfCcPME",2900,"month")]});
  }

  if(url.pathname==="/v1/subscriptions"&&url.searchParams.get("customer")==="cus_browser_individual"){
   const fixture=JSON.parse(require("node:fs").readFileSync("/tmp/route-browser-session.json","utf8"));
   return new Response(JSON.stringify({data:[{id:"sub_browser_individual",customer:"cus_browser_individual",status:"active",livemode:true,metadata:{organizationId:fixture.individualOrganizationId},latest_invoice:{status:"paid"},items:{data:[{current_period_end:Math.floor(Date.now()/1000)+86400,quantity:1,price:{id:"price_1UcZGHAJxC2GoXaRGEfCcPME"}}]}}]}),{headers:{"content-type":"application/json"}});
  }
  throw Error("Unexpected Stripe request in isolated browser fixture");
 }
 if(url.hostname==="api.tomtom.com"&&url.pathname.includes("/calculateRoute/")){
  const points=url.pathname.split("/calculateRoute/")[1].split("/json")[0].split(":").map(p=>p.split(",").map(Number));
  const n=points.length-2;
  return new Response(JSON.stringify({routes:[{legs:points.slice(1).map((p,i)=>({summary:{lengthInMeters:1000,travelTimeInSeconds:60},points:[{latitude:points[i][0],longitude:points[i][1]},{latitude:p[0],longitude:p[1]}]}))}],optimizedWaypoints:Array.from({length:n},(_,i)=>({providedIndex:i,optimizedIndex:n-i-1}))}),{headers:{"content-type":"application/json"}});
 }
 return realFetch(input,init);
};

// Test process only. Never load this file in a deployed server.
if(process.env.CI!=="true"||process.env.ROUTE_BROWSER_TEST!=="true"||!process.env.DATABASE_URL?.includes("@localhost:5432/route_test"))throw Error("Road fixtures are restricted to isolated CI.");
const realFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const raw=typeof input==="string"?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw);
 if(url.hostname==="api.tomtom.com"&&url.pathname.includes("/calculateRoute/")){
  const points=url.pathname.split("/calculateRoute/")[1].split("/json")[0].split(":").map(p=>p.split(",").map(Number));
  const n=points.length-2;
  return new Response(JSON.stringify({routes:[{legs:points.slice(1).map((p,i)=>({summary:{lengthInMeters:1000,travelTimeInSeconds:60},points:[{latitude:points[i][0],longitude:points[i][1]},{latitude:p[0],longitude:p[1]}]}))}],optimizedWaypoints:Array.from({length:n},(_,i)=>({providedIndex:i,optimizedIndex:n-i-1}))}),{headers:{"content-type":"application/json"}});
 }
 return realFetch(input,init);
};

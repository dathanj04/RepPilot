import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
export async function auditApp({browser,config,cookie,session}){
 const result={pages:[],internalLinks:[],externalLinks:[],issues:[]};
 const root="http://localhost:43123";
 const context=await browser.newContext(config);await context.addCookies([cookie]);const page=await context.newPage();
 page.setDefaultTimeout(20000);
 await page.route(/https:\/\/(api.tomtom.com\/maps|tile.openstreetmap.org)/,r=>r.fulfill({status:204,body:""}));
 const a="/accounts/"+session.accountId;
 const paths=["/today","/map","/accounts","/accounts/new","/tasks","/calendar","/route","/lunches","/lunches/new","/meetings","/meetings/new","/more","/settings","/billing","/reports","/spending","/compliance","/admin","/manager","/manager/themes","/onboarding","/notifications",a,a+"/edit",a+"/check-in",a+"/history/"+session.interactionId,"/lunches/"+session.lunchId,"/privacy","/terms","/support","/delete-account/confirm"];
 const seen=new Set(),external=new Set();
 for(const path of paths){
  const response=await page.goto(root+path);const status=response.status();
  result.pages.push({path,status,landed:new URL(page.url()).pathname});
  if(status>=400||new URL(page.url()).pathname==="/login")result.issues.push({path,status});
  const links=await page.locator("a[href]").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("href")));
  for(const href of links){
   if(!href||/^(mailto:|tel:|javascript:|data:)/.test(href))continue;
   const u=new URL(href,page.url());
   if(u.origin!==root){external.add(u.href);continue;}
   if(u.hash&&u.pathname===new URL(page.url()).pathname&&u.search===new URL(page.url()).search){
    if(!await page.locator('[id="'+CSSescape(decodeURIComponent(u.hash.slice(1)))+'"]').count())result.issues.push({path,missingAnchor:u.hash});
   }
   u.hash="";seen.add(u.pathname+u.search);
  }
 }
 const officeContext=await browser.newContext(config);
 for(const path of session.publicPaths){
  const r=await officeContext.request.get(root+path);
  result.pages.push({path:path.split("/").slice(0,-1).join("/")+"/[token]",status:r.status(),role:"public"});
  if(r.status()!==200)result.issues.push({path:"public invitation",status:r.status()});
 }
 await officeContext.close();
 for(const path of seen){
  // OAuth starts initiate a connection; these are checked by explicit provider tests, not a crawl.
  if(path.startsWith("/api/calendar/"))continue;
  const r=await context.request.get(root+path);
  result.internalLinks.push({path,status:r.status()});
  if(r.status()>=400)result.issues.push({path,status:r.status()});
 }
 result.externalLinks=[...external];
 const denied=await page.goto(root+"/platform");
 assert.notEqual(new URL(page.url()).pathname,"/platform","Customer cannot enter platform console");
 const owner=await browser.newContext({...config,viewport:{width:1280,height:900},isMobile:false});
 await owner.addCookies([{...cookie,value:session.platformCookie}]);const op=await owner.newPage();op.setDefaultTimeout(20000);
 for(const path of ["/platform","/platform/users","/platform/operations","/platform/audit","/platform/deletion-requests","/platform/workspaces/"+session.organizationId]){
  const r=await op.goto(root+path);result.pages.push({path,status:r.status(),role:"platform"});
  if(r.status()!==200||new URL(op.url()).pathname!==path)result.issues.push({path,status:r.status(),role:"platform"});
 }
 const pause=op.locator("details").filter({has:op.locator("summary",{hasText:"Pause workspace access"})});
 await pause.locator("summary").click();
 await pause.getByLabel("Reason",{exact:true}).fill("Verified browser acceptance pause test.");
 await pause.getByLabel("Your current password").fill("incorrect-password");
 await pause.getByLabel("I confirm this change.").check();await pause.getByRole("button",{name:"Confirm change",exact:true}).click();
 await pause.getByRole("alert").filter({hasText:"password"}).waitFor();
 await pause.getByLabel("Your current password").fill("Owner-browser-fixture-only!");
 await pause.getByRole("button",{name:"Confirm change",exact:true}).click();
 await op.getByText("Change saved and recorded in the audit log.",{exact:true}).waitFor();
 await page.goto(root+"/accounts");
 assert.equal(new URL(page.url()).pathname,"/support","Existing customer session is blocked after pause");
 await op.reload();
 const resume=op.locator("details").filter({has:op.locator("summary",{hasText:"Resume workspace access"})});
 await resume.locator("summary").click();
 await resume.getByLabel("Reason",{exact:true}).fill("Browser acceptance is complete; restore access.");
 await resume.getByLabel("Your current password").fill("Owner-browser-fixture-only!");
 await resume.getByLabel("I confirm this change.").check();await resume.getByRole("button",{name:"Confirm change",exact:true}).click();
 await op.getByText("Change saved and recorded in the audit log.",{exact:true}).waitFor();
 await page.goto(root+"/accounts");assert.equal(new URL(page.url()).pathname,"/accounts");
 await op.goto(root+"/platform/audit");await op.getByText("Verified browser acceptance pause test.",{exact:true}).waitFor();
 await op.screenshot({path:"route-browser-results/owner-audit.png",fullPage:true});
 await writeFile("route-browser-results/link-audit.json",JSON.stringify(result,null,2));
 console.log("LINK AUDIT: "+result.pages.length+" pages, "+result.internalLinks.length+" internal links, "+result.externalLinks.length+" external destinations inventoried. "+JSON.stringify(result.issues));
 assert.deepEqual(result.issues,[]);
 await owner.close();await context.close();
 console.log("PASS: platform role isolation, password step-up, audited pause/resume, existing-session revocation, cross-app internal link crawl.");
}
function CSSescape(value){return value.replace(/["\\]/g,"\\$&");}

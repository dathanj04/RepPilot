import {createHmac} from "node:crypto";
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
 await writeFile("route-browser-results/link-audit.json",JSON.stringify(result,null,2));
 console.log("CUSTOMER LINK AUDIT: "+result.pages.length+" pages, "+result.internalLinks.length+" links; issues="+JSON.stringify(result.issues));
 await page.goto(root+"/platform");
 await page.waitForURL(url=>url.pathname==="/today");
 assert.equal(await page.getByRole("heading",{name:"Platform overview",exact:true}).count(),0,"Customer cannot see owner data");
 // Real browser enrollment/challenge against isolated PostgreSQL, no production identities.
 const security=await browser.newContext(config);await security.addCookies([{...cookie,value:session.platformUnverifiedCookie}]);
 const sp=await security.newPage();sp.setDefaultTimeout(20000);
 await sp.goto(root+"/platform");await sp.waitForURL(url=>url.pathname==="/owner-security");assert.equal(new URL(sp.url()).pathname,"/owner-security");
 const code=authenticatorCode("JBSWY3DPEHPK3PXP");
 await sp.getByLabel("Authenticator or recovery code").fill(code);await sp.getByRole("button",{name:"Verify identity",exact:true}).click();
 await sp.getByRole("link",{name:"Open owner console",exact:true}).waitFor();
 await sp.getByRole("link",{name:"Open owner console",exact:true}).click();await sp.waitForURL(url=>url.pathname==="/platform");
 const replay=await browser.newContext(config);await replay.addCookies([{...cookie,value:session.platformUnverifiedCookie}]);const rp=await replay.newPage();
 await rp.goto(root+"/platform");await rp.getByLabel("Authenticator or recovery code").fill(code);await rp.getByRole("button",{name:"Verify identity",exact:true}).click();await rp.getByRole("alert").filter({hasText:"already used"}).waitFor();
 await replay.close();await security.close();
 const enrollment=await browser.newContext(config);await enrollment.addCookies([{...cookie,value:session.enrollmentCookie}]);const ep=await enrollment.newPage();
 await ep.goto(root+"/platform");await ep.waitForURL(url=>url.pathname==="/owner-security");assert.equal(new URL(ep.url()).pathname,"/owner-security");
 await ep.getByLabel("Your current password",{exact:true}).fill("Owner-browser-fixture-only!");await ep.getByRole("button",{name:"Create authenticator setup key",exact:true}).click();
 const secret=await ep.getByTestId("mfa-setup-secret").innerText();await ep.getByLabel("New six-digit code").fill(authenticatorCode(secret));await ep.getByRole("button",{name:"Enable authenticator",exact:true}).click();
 await ep.getByRole("heading",{name:"Save your recovery codes",exact:true}).waitFor();
 const recovery=(await ep.locator("pre").innerText()).split("\n")[0];await ep.getByLabel("I saved my recovery codes.").check();await ep.getByRole("link",{name:"Open owner console",exact:true}).click();await ep.waitForURL(url=>url.pathname==="/platform");
 // Old enrollment cookie must be revoked after enabling MFA.
 const old=await browser.newContext(config);await old.addCookies([{...cookie,value:session.enrollmentCookie}]);const oldPage=await old.newPage();await oldPage.goto(root+"/platform");await oldPage.waitForURL(url=>url.pathname==="/login");assert.equal(new URL(oldPage.url()).pathname,"/login");await old.close();
 assert.match(recovery,/^[A-F0-9]{4}(-[A-F0-9]{4}){5}$/);
 await enrollment.close();
 const recoveryUi=await browser.newContext(config);const pp=await recoveryUi.newPage();await pp.goto(root+"/login");await pp.getByRole("link",{name:"Forgot password?",exact:true}).click();await pp.getByLabel("Account email").fill("unknown@example.invalid");await pp.getByRole("button",{name:"Send reset link",exact:true}).click();await pp.getByRole("status").filter({hasText:"If that email has an account"}).waitFor();await recoveryUi.close();
 console.log("PASS: owner MFA enrollment, challenge, replay rejection, revoked pre-enrollment session and private password recovery response.");
 const owner=await browser.newContext({...config,viewport:{width:1280,height:900},isMobile:false});
 await owner.addCookies([{...cookie,value:session.platformCookie}]);const op=await owner.newPage();op.setDefaultTimeout(20000);
 for(const path of ["/platform","/platform/revenue","/platform/users","/platform/operations","/platform/audit","/platform/deletion-requests","/platform/workspaces/"+session.organizationId]){
  const r=await op.goto(root+path);result.pages.push({path,status:r.status(),role:"platform"});
  if(r.status()!==200||new URL(op.url()).pathname!==path)result.issues.push({path,status:r.status(),role:"platform"});
 }
 await op.goto(root+"/platform/revenue");await op.getByRole("heading",{name:"Paying customers",exact:true}).waitFor();await op.getByText("$69.00 / month",{exact:true}).waitFor();
 const exportResponse=await owner.request.get(root+"/platform/revenue/export");assert.equal(exportResponse.status(),200);assert.match(exportResponse.headers()["content-disposition"],/\.xlsx/);assert.match(exportResponse.headers()["cache-control"],/no-store/);
 const {default:ExcelJS}=await import("exceljs");const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await exportResponse.body());assert.equal(workbook.getWorksheet("Paying customers").rowCount,3);assert.equal(workbook.getWorksheet("Summary").getCell("B3").value,2);
 const denied=await context.request.get(root+"/platform/revenue/export");assert.ok(!String(denied.headers()["content-type"]).includes("spreadsheetml"),"Customer role must not export billing data");
 console.log("PASS: owner paying-customer dashboard, annual/monthly totals, real Excel download and customer-role export denial.");
 await op.goto(root+"/platform/workspaces/"+session.organizationId);
 const pause=op.locator("details").filter({has:op.locator("summary",{hasText:"Pause workspace access"})});
 await pause.locator("summary").click();
 await pause.getByLabel("Reason",{exact:true}).fill("Verified browser acceptance pause test.");
 await pause.getByLabel("Your current password").fill("incorrect-password");
 await pause.getByLabel("I confirm this change.").check();await pause.getByRole("button",{name:"Confirm change",exact:true}).click();
 await pause.getByRole("alert").filter({hasText:"password"}).waitFor();
 console.log("Owner password check rejected; retained reason: "+await pause.getByLabel("Reason",{exact:true}).inputValue().catch(async e=>{console.log("Owner DOM: "+await op.locator("main").innerText());throw e;}));
 assert.equal(await pause.getByLabel("Reason",{exact:true}).inputValue(),"Verified browser acceptance pause test.");
 assert.equal(await pause.getByLabel("I confirm this change.").isChecked(),true);
 await pause.getByLabel("Your current password").fill("Owner-browser-fixture-only!");
 await pause.getByRole("button",{name:"Confirm change",exact:true}).click();
 await op.getByText("Change saved and recorded in the audit log.",{exact:true}).waitFor().catch(async e=>{console.log("Owner form state: "+await op.locator("main").innerText());throw e;});
 await page.goto(root+"/accounts");
 await page.waitForURL(url=>url.pathname==="/support");
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

function authenticatorCode(secret){
 const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,value=0;const bytes=[];
 for(const c of secret){value=(value<<5)|alphabet.indexOf(c);bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac("sha1",Buffer.from(bytes)).update(counter).digest(),offset=h[h.length-1]&15;
 return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
}

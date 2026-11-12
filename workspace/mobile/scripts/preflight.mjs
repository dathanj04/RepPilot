import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('capacitor.config.json',root)));
assert.equal(config.appId,'com.reppilot.app');assert.equal(config.server.url,'https://reppilot-demo.dathanjohnson826.chatgpt.site');assert.equal(new URL(config.server.url).protocol,'https:');assert.equal(config.server.cleartext,false);assert.equal(config.android.allowMixedContent,false);
for(const file of ['android/app/src/main/AndroidManifest.xml','ios/App/App/Info.plist','www/index.html','www/offline.html'])assert.ok((await readFile(new URL(file,root),'utf8')).length);
console.log('PASS: native project files, selected origin, HTTPS and fallback assets.');
if(process.argv.includes('--release')){const readiness=JSON.parse(await readFile(new URL('release-readiness.json',root)));const missing=Object.entries(readiness.checks).filter(([,v])=>v!==true).map(([k])=>k);if(missing.length){console.error('STORE RELEASE BLOCKED. Verify and record evidence for: '+missing.join(', '));process.exitCode=1;}}

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const check = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`); if (!ok) process.exitCode = 1; };
const config = readFileSync('capacitor.config.ts','utf8');
check(config.includes('https://reppilot.app') && !config.includes('grok.bot'), 'Production app origin is reppilot.app');
check(config.includes('errorPath: "offline.html"') && existsSync('mobile/www/offline.html'), 'Packaged connection-error screen exists');
for (const file of ['mobile/www/index.html','mobile/www/offline.html']) check(!readFileSync(file,'utf8').includes('grok.bot'), `${file} uses current links`);
for (const file of ['ios/App/App/Info.plist','android/app/src/main/AndroidManifest.xml']) check(readFileSync(file,'utf8').includes(file.endsWith('plist') ? 'NSLocationWhenInUseUsageDescription' : 'ACCESS_FINE_LOCATION'), `${file} declares location access`);
if (process.argv.includes('--android')) {
 check(Boolean(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || existsSync('android/local.properties')), 'Android SDK configured');
 check(spawnSync('java',['-version']).status === 0, 'Java installed');
}
if (process.argv.includes('--ios')) check(spawnSync('xcodebuild',['-version']).status === 0, 'Xcode installed');

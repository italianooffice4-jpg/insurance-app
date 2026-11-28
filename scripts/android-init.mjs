// يُنشئ مشروع أندرويد (مرة واحدة) ويضبط الأيقونة وصلاحية الكاميرا.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const run = (c) => execSync(c, { stdio: 'inherit' });
run('npm run prepare-www');
if (!existsSync('android')) run('npx cap add android');
const mf = 'android/app/src/main/AndroidManifest.xml';
let m = readFileSync(mf, 'utf8');
if (!m.includes('android.permission.CAMERA')) {
  m = m.replace('</manifest>', '    <uses-permission android:name="android.permission.CAMERA" />\n</manifest>');
  writeFileSync(mf, m);
}
try { run('npx capacitor-assets generate --android --iconBackgroundColor "#12101a" --iconBackgroundColorDark "#12101a"'); }
catch (e) { console.warn('تخطي توليد الأيقونة (غير حرج)'); }
run('npx cap sync android');
console.log('\nتم. افتح مجلد android في Android Studio أو شغّل: cd android && gradlew assembleDebug');

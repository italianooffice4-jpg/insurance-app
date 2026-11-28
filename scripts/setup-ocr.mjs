// تجهيز محرك قراءة البطاقة (OCR) ليعمل بدون إنترنت داخل البرنامج.
// الاستخدام (مرة واحدة، على جهاز فيه إنترنت، من مجلد المشروع):
//   npm i tesseract.js@5 tesseract.js-core@5
//   node scripts/setup-ocr.mjs
// النتيجة: مجلد src/vendor/tesseract/ فيه المحرك وبيانات اللغة العربية (النسخة الدقيقة best).
import { mkdirSync, copyFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src', 'vendor', 'tesseract');
const lang = join(out, 'lang');
mkdirSync(lang, { recursive: true });

const nm = join(root, 'node_modules');
const must = (p) => { if (!existsSync(p)) { console.error('ناقص: ' + p + '\nشغّل أولاً: npm i tesseract.js@5 tesseract.js-core@5'); process.exit(1); } return p; };

copyFileSync(must(join(nm, 'tesseract.js', 'dist', 'tesseract.min.js')), join(out, 'tesseract.min.js'));
copyFileSync(must(join(nm, 'tesseract.js', 'dist', 'worker.min.js')), join(out, 'worker.min.js'));
const core = must(join(nm, 'tesseract.js-core'));
let n = 0;
for (const f of readdirSync(core)) if (/^tesseract-core.*\.(js|wasm)$/.test(f)) { copyFileSync(join(core, f), join(out, f)); n++; }
console.log('تم نسخ المحرك +', n, 'ملف core');

// بيانات اللغة (النسخة الدقيقة best). الحجم الإجمالي نحو 10–15 ميجا.
for (const l of ['ara']) { // العربية فقط: الإنجليزية لم تعد مستخدمة في القراءة
  const url = `https://tessdata.projectnaptha.com/4.0.0_best/${l}.traineddata.gz`;
  process.stdout.write('تنزيل ' + l + ' ... ');
  const r = await fetch(url);
  if (!r.ok) { console.error('فشل (' + r.status + ') ' + url); process.exit(1); }
  writeFileSync(join(lang, l + '.traineddata.gz'), Buffer.from(await r.arrayBuffer()));
  console.log('تم');
}
console.log('اكتمل. أعد تشغيل البرنامج وجرّب «قراءة بطاقة».');

// يجمع ملفات الواجهة في مجلد www (الذي يقرأه Capacitor).
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const f of readdirSync(root)) if (/\.png$/i.test(f)) cpSync(join(root, f), join(www, f));
cpSync(join(root, 'src'), join(www, 'src'), { recursive: true });
cpSync(join(root, 'android-shim.js'), join(www, 'android-shim.js'));

const xl = join(root, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');
if (!existsSync(xl)) { console.error('ناقص xlsx — شغّل npm install أولاً'); process.exit(1); }
mkdirSync(join(www, 'node_modules', 'xlsx', 'dist'), { recursive: true });
cpSync(xl, join(www, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'));

let html = readFileSync(join(root, 'index.html'), 'utf8');
const tag = '<script src="node_modules/xlsx/dist/xlsx.full.min.js"></script>';
if (!html.includes(tag)) { console.error('لم أجد وسم xlsx في index.html'); process.exit(1); }
html = html.replace(tag, '<script src="android-shim.js"></script>\n' + tag);
writeFileSync(join(www, 'index.html'), html);
console.log('www جاهز');

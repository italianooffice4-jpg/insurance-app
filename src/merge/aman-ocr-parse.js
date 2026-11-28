/* ============================================================================
   Aman System v10 — محلل نص بطاقة الرقم القومي (مستقل ويمكن اختباره بدون متصفح)
   يأخذ النص الخام الناتج عن OCR ويستخرج: الرقم القومي، الاسم، الوظيفة، العنوان.
   ============================================================================ */
(function(root){
'use strict';
const GOV={'01':'القاهرة','02':'الإسكندرية','03':'بورسعيد','04':'السويس','11':'دمياط','12':'الدقهلية','13':'الشرقية','14':'القليوبية','15':'كفر الشيخ','16':'الغربية','17':'المنوفية','18':'البحيرة','19':'الإسماعيلية','21':'الجيزة','22':'بني سويف','23':'الفيوم','24':'المنيا','25':'أسيوط','26':'سوهاج','27':'قنا','28':'أسوان','29':'الأقصر','31':'البحر الأحمر','32':'الوادي الجديد','33':'مطروح','34':'شمال سيناء','35':'جنوب سيناء','88':'مولود خارج الجمهورية'};
const AD='٠١٢٣٤٥٦٧٨٩',PD='۰۱۲۳۴۵۶۷۸۹';
const dig=s=>String(s==null?'':s).replace(/[٠-٩]/g,d=>AD.indexOf(d)).replace(/[۰-۹]/g,d=>PD.indexOf(d));
const nz=s=>String(s||'').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const GN=Object.values(GOV).map(g=>[g,nz(g)]).sort((a,b)=>b[1].length-a[1].length);

/* هل الرقم يصلح كرقم قومي (قرن + تاريخ ميلاد + كود محافظة)؟ */
function nidOK(id){
  if(!/^\d{14}$/.test(id))return false;const c=id[0];if(c!=='2'&&c!=='3')return false;
  const y=(c==='2'?1900:2000)+(+id.slice(1,3)),m=+id.slice(3,5),d=+id.slice(5,7),b=new Date(y,m-1,d);
  if(b.getFullYear()!==y||b.getMonth()!==m-1||b.getDate()!==d)return false;
  if(b>new Date())return false;return !!GOV[id.slice(7,9)];
}
/* حروف يخلطها OCR مع الأرقام داخل السلسلة الرقمية */
const CONF={O:'0',o:'0',Q:'0',D:'0',I:'1',l:'1','|':'1','!':'1',i:'1',Z:'2',z:'2',S:'5',s:'5',B:'8',b:'6',G:'6',g:'9',q:'9'};
function digitRuns(text){
  const out=[];
  String(text||'').split(/\r?\n/).forEach(line0=>{[line0,line0.replace(/[.·•∙]/g,'0')].forEach(line=>{
    const t=dig(line);
    /* 1) أرقام صريحة */
    const m=t.match(/\d[\d\s\-.،,]{11,24}\d/g)||[];
    m.forEach(x=>out.push(x.replace(/\D/g,'')));
    /* 2) أرقام مختلطة بحروف مشابهة */
    const m2=t.match(/[0-9OoQDIli|!ZzSsBbGgq][0-9OoQDIli|!ZzSsBbGgq\s.\-]{11,26}[0-9OoQDIli|!ZzSsBbGgq]/g)||[];
    m2.forEach(x=>{const y=x.replace(/[\s.\-]/g,'');if(y.length<13)return;if((y.match(/\d/g)||[]).length<6)return;out.push(y.replace(/[^0-9]/g,c=>CONF[c]||''))});

  });});
  return out;
}
/* تصويت بالموضع: أخطاء القراءة تختلف من محاولة لأخرى، فنأخذ الرقم الأكثر تكراراً في كل خانة من المحاولات المتقاربة */
const ham=(a,b)=>{let n=0;for(let i=0;i<14;i++)if(a[i]!==b[i])n++;return n};
function voteNID(c){
  const L=c.filter(x=>/^\d{14}$/.test(x));if(L.length<2)return '';
  let best='',bn=1;
  L.forEach(ctr=>{
    const grp=L.filter(x=>ham(x,ctr)<=4);if(grp.length<2)return;
    let v='';for(let i=0;i<14;i++){const f={};grp.forEach(x=>f[x[i]]=(f[x[i]]||0)+1);v+=Object.keys(f).sort((a,b)=>f[b]-f[a])[0]}
    if(nidOK(v)&&grp.length>bn){best=v;bn=grp.length}
  });
  return best;
}
/* يُرجع {id,valid,cands} */
function findNID(text){
  const c=[];
  digitRuns(text).forEach(r=>{
    if(r.length===14)c.push(r);
    else if(r.length>14)for(let i=0;i+14<=r.length;i++)c.push(r.slice(i,i+14));
  });
  const uniq=[...new Set(c)];
  /* شكل الرقم الصحيح لا يكفي (أرقام خاطئة كثيرة تبدو صالحة)، فالتصويت بين المحاولات له الأولوية */
  const vt=voteNID(c);if(vt)return{id:vt,valid:true,agreed:true,cands:uniq};
  let good=uniq.filter(nidOK);
  /* الأكثر تكراراً بين الصالحة أولاً */
  const cnt=x=>c.filter(y=>y===x).length;good.sort((a,b)=>cnt(b)-cnt(a));
  if(good.length)return{id:good[0],valid:true,agreed:false,cands:uniq};
  const x14=uniq.find(x=>x.length===14);
  return{id:x14||'',valid:false,agreed:false,cands:uniq};
}

const STOP=/جمهوري|مصر|العربي|بطاق|تحقيق|الشخصي|الرقم|القوم|رقم|تاريخ|الميلاد|الاصدار|الانتهاء|صالح|حتي|الوظيف|المهن|الديان|مسلم|مسيحي|الحال|الاجتماع|النوع|ذكر|انثي|اعزب|متزوج|ارمل|مطلق|وزار|الداخلي|مصلح|الاحوال|المدني|يحمل|عنوان|العنوان|توقيع|الموطن/;
const ADDRKW=/(^|\s)(شارع|ش|مركز|قسم|محافظه|مدينه|حي|عماره|برج|قريه|كفر|نجع|عزبه|ميدان|طريق|امام|بجوار|بلوك|مبني|شقه|دور|مساكن|حاره|زقاق|عقار|ك|م|ق)(\s|$)/;
const arCount=s=>(s.match(/[\u0621-\u064A]/g)||[]).length;
const cleanAr=s=>s.replace(/[^\u0621-\u064A\u0660-\u0669\d\s\-\/.,،]/g,' ').replace(/[\u064B-\u065F\u0640]/g,'').replace(/\s+/g,' ').trim();
const cleanName=s=>cleanAr(s).replace(/[\d\-\/.,،]/g,' ').split(/\s+/).filter(w=>w.length>=2).join(' ');

function parseCard(text){
  const raw=String(text||'');
  const res={nid:'',nidValid:false,name:'',job:'',addr:{raw:'',b:'',s:'',v:'',d:'',g:''},nidCands:[],raw};
  const f=findNID(raw);res.nid=f.id;res.nidValid=f.valid;res.nidCands=f.cands;
  const lines=raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  /* سطر الرقم القومي */
  let ni=-1;lines.forEach((l,i)=>{if(ni<0&&(dig(l).replace(/\D/g,'').length>=10))ni=i});
  /* الوظيفة (ظهر البطاقة) */
  for(let i=0;i<lines.length;i++){
    const n=nz(lines[i]);
    if(/(الوظيف|المهن)/.test(n)){
      let v=nz(cleanAr(lines[i])).replace(/.*(الوظيفه|المهنه|الوظيفة|المهنة)\s*:?/,'').trim();
      if(!v||v.length<2){const nx=lines[i+1]?cleanName(lines[i+1]):'';if(nx&&!STOP.test(nz(nx)))v=nx}
      v=cleanName(v);if(v&&!STOP.test(nz(v))){res.job=v;break}
    }
  }
  /* الاسم والعنوان: الأسطر العربية فوق سطر الرقم القومي */
  const head=(ni>=0?lines.slice(0,ni):lines).filter(l=>arCount(l)>=2);
  const isBack=/(الوظيف|الديان|الحال[هة] الاجتماع|المهن|الاصدار|الانتهاء)/.test(nz(raw)),body=[];
  /* ترويسة البطاقة تُستبعد، لكن سطراً به رقم أو كلمة عنوان (مثل «شارع الجمهورية») يبقى */
  head.forEach(l=>{const n=nz(cleanAr(l));if(!n)return;const addrish=/\d/.test(dig(l))||ADDRKW.test(n);if(STOP.test(n)&&!addrish)return;body.push(l)});
  const nameL=[];let k=0;
  for(;k<body.length&&nameL.length<2;k++){
    const l=body[k],n=nz(cleanAr(l));
    if(/\d/.test(dig(l))||ADDRKW.test(n))break;
    const c=cleanName(l);if(c)nameL.push(c);
  }
  res.name=isBack&&ni<0?'':nameL.join(' ');
  const addrL=(isBack&&ni<0)||(ni<0&&!res.name)?[]:body.slice(k).map(l=>cleanAr(l)).filter(Boolean);
  const addr=addrL.join(' - ');res.addr.raw=dig(addr);
  const A=dig(addr);
  /* المحافظة: آخر اسم محافظة يظهر في العنوان */
  let gi=-1,gv='';GN.forEach(([g,n])=>{const i=nz(A).lastIndexOf(n);if(i>=0&&i>=gi){if(i>gi||n.length>nz(gv).length){gi=i;gv=g}}});
  res.addr.g=gv;
  let m;
  if((m=A.match(/(?:قسم|مركز)\s+((?:(?!محافظه|محافظة)[^\-,،\s]+\s*)+)/)))res.addr.d=m[0].replace(/\s+/g,' ').trim();
  else if((m=A.match(/(?:مدينه|مدينة)\s+([^\-,،]+)/)))res.addr.d=m[0].trim();
  if((m=A.match(/(?:قريه|قرية|نجع|عزبه|عزبة|كفر)\s+[^\-,،]+/)))res.addr.v=m[0].trim();
  if((m=A.match(/(?:شارع|ش\.?)\s+(?:(?!مركز|قسم|مدينه|مدينة|محافظه|محافظة)[^\-,،\s]+\s*)+/)))res.addr.s=m[0].replace(/^ش\.?\s+/,'شارع ').trim();
  if((m=A.match(/(?:عقار|عماره|عمارة|رقم)\s*(\d+)/)))res.addr.b=m[1];
  else if((m=A.match(/(?:^|[\s\-])(\d{1,4})\s*(?=شارع|ش\s|ش\.)/)))res.addr.b=m[1];
  else if((m=A.match(/^\s*(\d{1,4})\b/)))res.addr.b=m[1];
  /* تنظيف: لا تكرّر اسم المحافظة داخل المركز/الشارع */
  ['d','s','v'].forEach(x=>{if(res.addr[x]&&gv)res.addr[x]=res.addr[x].replace(new RegExp('\\s*(?:محافظة|محافظه)?\\s*'+gv+'\\s*$'),'').trim()});
  /* احتياطي: لو لم تُطابق الأنماط شيئاً، السطر الأول من العنوان = الشارع/الموقع، والثاني (بدون المحافظة) = القسم/المركز */
  if(!res.addr.s&&addrL.length)res.addr.s=dig(cleanAr(addrL[0])).trim();
  if(!res.addr.d&&addrL.length>1){let d=dig(cleanAr(addrL[1])),parts=d.split(/\s*[-–]\s*/).filter(Boolean);if(gv&&parts.length>1&&nz(parts[parts.length-1]).replace(/^محافظه /,'')===nz(gv))parts.pop();d=parts.join(' - ').trim();if(d)res.addr.d=d}
  return res;
}
/* دمج نتائج عدة صفحات (وجه + ظهر): أول قيمة غير فارغة، والرقم القومي الصالح له الأولوية */
function merge(list){
  const o={nid:'',nidValid:false,name:'',job:'',addr:{raw:'',b:'',s:'',v:'',d:'',g:''},nidCands:[],raw:''};
  list.forEach(r=>{
    if(r.nid&&(!o.nid||(r.nidValid&&!o.nidValid))){o.nid=r.nid;o.nidValid=r.nidValid}
    if(!o.name&&r.name)o.name=r.name;if(!o.job&&r.job)o.job=r.job;
    Object.keys(o.addr).forEach(k=>{if(!o.addr[k]&&r.addr[k])o.addr[k]=r.addr[k]});
    o.nidCands.push(...r.nidCands);o.raw+=(o.raw?'\n----\n':'')+r.raw;
  });
  return o;
}
const API={parseCard,findNID,nidOK,voteNID,merge,dig,nz,GOV};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.a9parse=API;
})(typeof window!=='undefined'?window:globalThis);

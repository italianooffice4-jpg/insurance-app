/* ============================================================================
   Aman System v10 — طبقة إضافية (تُحمَّل بعد aman-v9.js و aman-ocr-parse.js)
   1) صورة المستخدم بدل أيقونة الحساب
   2) قراءة بطاقة الرقم القومي بالـ OCR بعد المسح الضوئي (أو من صورة) مع شاشة مراجعة
   كل ما يضاف تحت window.a9 حتى لا يتعارض مع الكود القديم.
   ============================================================================ */
(function(){
'use strict';
const A=window.a9||(window.a9={});
const PRS=window.a9parse;

/* ======================================================================
   1) صورة المستخدم
   ====================================================================== */
A.avatar=(size,fs)=>CU&&CU.photo
  ?`<img class=av-img src="${CU.photo}" alt="" style="width:${size}px;height:${size}px">`
  :`<div class=av style="width:${size}px;height:${size}px;font-size:${fs}px">${esc(ini(CU?CU.name:'?'))}</div>`;

A.syncAvatar=()=>{
  const b=$('ub');if(!b||!CU)return;
  b.classList.toggle('has-photo',!!CU.photo);
  b.innerHTML=CU.photo?`<img class=ub-img src="${CU.photo}" alt="">`:ic('user',18);
  b.title=CU.name?('الحساب — '+CU.name):'الحساب';
};

/* تصغير الصورة إلى مربع 256×256 (قص من المنتصف) لتبقى خفيفة في التخزين */
async function squarePhoto(file){
  let bmp;
  try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){bmp=await createImageBitmap(file)}
  const s=Math.min(bmp.width,bmp.height),c=document.createElement('canvas');c.width=c.height=256;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,256,256);
  x.drawImage(bmp,(bmp.width-s)/2,(bmp.height-s)/2,s,s,0,0,256,256);
  return c.toDataURL('image/jpeg',.86);
}
function savePhoto(data){
  const us=US(),x=us.find(y=>y.u==CU.u);if(!x)return false;
  if(data)x.photo=data;else delete x.photo;
  sU(us);
  /* sU تتجاهل أخطاء التخزين (امتلاء المساحة) فنتحقق من الحفظ فعلاً */
  const back=US().find(y=>y.u==CU.u);if(data&&(!back||back.photo!==data))return false;
  CU=back;return true;
}
A.photoPick=()=>{
  const i=document.createElement('input');i.type='file';i.accept='image/*';
  i.onchange=async()=>{
    const f=i.files[0];if(!f)return;
    if(!/^image\//.test(f.type))return toast('اختر ملف صورة (JPG أو PNG)');
    try{
      const d=await squarePhoto(f);
      if(!savePhoto(d))return toast('تعذر حفظ الصورة (مساحة التخزين ممتلئة)');
      A.syncAvatar();userM();toast('تم تغيير الصورة',1);
    }catch(e){toast('تعذر قراءة الصورة، جرّب صورة أخرى')}
  };
  i.click();
};
A.photoDel=()=>{savePhoto(null);A.syncAvatar();userM();toast('تمت إزالة الصورة',1)};

/* نافذة الحساب: نفس القديمة + الصورة */
userM=function(){
  openM(`<div style='display:flex;gap:16px;align-items:center'>
<div class=avw>${A.avatar(76,26)}<button type=button class=avc title='تغيير الصورة' onclick=a9.photoPick()>${ic('edit',13)}</button></div>
<div><b>${esc(CU.name)}</b><div class=mut>@${esc(CU.u)} · ${esc(CU.role)}</div>
<div style='margin-top:8px;display:flex;gap:6px;flex-wrap:wrap'><button type=button class='btn s sm' onclick=a9.photoPick()>${CU.photo?'تغيير الصورة':'إضافة صورة'}</button>${CU.photo?`<button type=button class='btn s sm d' onclick=a9.photoDel()>إزالة الصورة</button>`:''}</div></div></div>
<label class=mut style='display:block;margin-top:14px'>تغيير الرقم السري</label><input type=password id=op placeholder='الرقم السري الحالي'><input type=password id=np1 placeholder='الرقم السري الجديد (6 أحرف على الأقل)' style='margin-top:8px'>
<div class=row><button class=btn onclick=chPw()>${ic('check',15)} تغيير الرقم السري</button><button class='btn s d' onclick=lo()>${ic('logout',15)} تسجيل الخروج</button><button class='btn s' onclick=closeM()>إغلاق</button></div>`,440);
};
{const _enter=enter;enter=function(){_enter.apply(this,arguments);A.syncAvatar()}}
try{if(typeof CU!=='undefined'&&CU)A.syncAvatar()}catch(e){}

/* ======================================================================
   2) محرك OCR (Tesseract.js) — محلي أولاً، ثم CDN إن لم توجد الملفات المحلية
   ====================================================================== */
const LOCAL=new URL('src/vendor/tesseract/',document.baseURI).href;
const CDN='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const BEST='https://cdn.jsdelivr.net/npm/@tesseract.js-data/ara/4.0.0_best_int';
const E={worker:null,ready:null,local:true};
const loadScript=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('تعذر تحميل '+src));document.head.appendChild(s)});
const ST={'loading tesseract core':'تحميل محرك القراءة','initializing tesseract':'تجهيز المحرك','initialized tesseract':'تجهيز المحرك','loading language traineddata':'تحميل بيانات اللغة العربية','loaded language traineddata':'تحميل بيانات اللغة','initializing api':'تجهيز المحرك','initialized api':'تجهيز المحرك','recognizing text':'قراءة النص'};

async function engine(onStatus){
  if(E.worker)return E.worker;
  if(E.ready)return E.ready;
  E.ready=(async()=>{
    if(!window.Tesseract){
      try{await loadScript(LOCAL+'tesseract.min.js')}
      catch(e){E.local=false;try{await loadScript(CDN)}catch(x){throw new Error('محرك القراءة (OCR) غير مثبّت. شغّل scripts/setup-ocr.mjs لتثبيته، أو اتصل بالإنترنت مرة واحدة.')}}
    }
    const logger=m=>{try{onStatus&&onStatus(ST[m.status]||m.status,m.progress)}catch(e){}};
    const mk=o=>Tesseract.createWorker('ara',1,Object.assign({logger},o)); /* عربي فقط: خلط الإنجليزية يُدخل حروفاً لاتينية بين الأرقام والكلمات */
    let w;
    if(E.local){
      try{w=await mk({workerPath:LOCAL+'worker.min.js',corePath:LOCAL,langPath:LOCAL+'lang',gzip:true,workerBlobURL:false})}
      catch(e){w=await mk({})} /* ملفات اللغة المحلية ناقصة → جرّب التنزيل من الإنترنت */
    }else{
      /* لا ملفات محلية: نموذج العربية الدقيق (best) من الشبكة، ثم الافتراضي إن تعذر */
      try{w=await mk({langPath:BEST})}catch(e){w=await mk({})}
    }
    await w.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});
    E.worker=w;return w;
  })().catch(e=>{E.ready=null;throw e});
  return E.ready;
}
const linesOf=d=>d.lines||((d.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])));
async function recog(w,img,params){
  await w.setParameters(Object.assign({tessedit_char_whitelist:'',tessedit_pageseg_mode:'6'},params||{}));
  const r=await w.recognize(img,{},{text:true,blocks:true});
  return r.data;
}

/* ---------- تجهيز صورة البطاقة: قص الحدود + تدوير + تكبير + تحسين التباين ---------- */
const sniff=u=>(u[0]===0x89&&u[1]===0x50)?'image/png':'image/jpeg';
async function toBitmap(u){
  const b=new Blob([u],{type:sniff(u)});
  try{return await createImageBitmap(b,{imageOrientation:'from-image'})}catch(e){return await createImageBitmap(b)}
}
function cardBox(bmp){
  const sw=Math.min(480,bmp.width),sh=Math.max(1,Math.round(bmp.height*sw/bmp.width)),c=document.createElement('canvas');c.width=sw;c.height=sh;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,sw,sh);
  const d=x.getImageData(0,0,sw,sh).data,med=a=>{a.sort((p,q)=>p-q);return a[a.length>>1]};
  const R=[],G=[],B=[];
  const ring=(px,py)=>{const i=(py*sw+px)*4;R.push(d[i]);G.push(d[i+1]);B.push(d[i+2])};
  for(let i=0;i<sw;i++){ring(i,0);ring(i,1);ring(i,sh-1);ring(i,sh-2)}
  for(let j=0;j<sh;j++){ring(0,j);ring(1,j);ring(sw-1,j);ring(sw-2,j)}
  const br=med(R),bg=med(G),bb=med(B),rc=new Uint16Array(sh),cc=new Uint16Array(sw);
  for(let j=0;j<sh;j++)for(let i=0;i<sw;i++){const k=(j*sw+i)*4;if(Math.max(Math.abs(d[k]-br),Math.abs(d[k+1]-bg),Math.abs(d[k+2]-bb))>26){rc[j]++;cc[i]++}}
  const rt=sw*.05,ct=sh*.05;let y0=0,y1=sh-1,x0=0,x1=sw-1;
  while(y0<sh&&rc[y0]<rt)y0++;while(y1>y0&&rc[y1]<rt)y1--;while(x0<sw&&cc[x0]<ct)x0++;while(x1>x0&&cc[x1]<ct)x1--;
  const bw=x1-x0+1,bh=y1-y0+1;if(bw<sw*.2||bh<sh*.15)return null;
  if(bw*bh>sw*sh*.94)return null; /* المستند كله هو الصورة (لا خلفية ظاهرة) */
  const k=bmp.width/sw,pad=Math.round(sw*.012);
  const X0=Math.max(0,x0-pad)*k,Y0=Math.max(0,y0-pad)*k,X1=Math.min(sw-1,x1+pad)*k,Y1=Math.min(sh-1,y1+pad)*k;
  return{x:X0,y:Y0,w:X1-X0,h:Y1-Y0};
}
function rotCv(cv,deg){
  if(!deg)return cv;const o=document.createElement('canvas'),q=deg%180;
  o.width=q?cv.height:cv.width;o.height=q?cv.width:cv.height;const x=o.getContext('2d');
  x.translate(o.width/2,o.height/2);x.rotate(deg*Math.PI/180);x.drawImage(cv,-cv.width/2,-cv.height/2);return o;
}
async function prepCard(u){
  const bmp=await toBitmap(u),box=cardBox(bmp)||{x:0,y:0,w:bmp.width,h:bmp.height};
  const sc=Math.min(2600,Math.max(1700,box.w*1.0))/box.w,w=Math.round(box.w*sc),h=Math.round(box.h*sc);
  let cv=document.createElement('canvas');cv.width=w;cv.height=h;
  cv.getContext('2d').drawImage(bmp,box.x,box.y,box.w,box.h,0,0,w,h);
  if(h>w*1.05)cv=rotCv(cv,90); /* البطاقة أفقية دائماً */
  /* تدرج رمادي + مط التباين (1% — 99%) */
  const x=cv.getContext('2d'),im=x.getImageData(0,0,cv.width,cv.height),p=im.data,hist=new Uint32Array(256);
  for(let i=0;i<p.length;i+=4){const l=(p[i]*.299+p[i+1]*.587+p[i+2]*.114)|0;p[i]=l;hist[l]++}
  const tot=cv.width*cv.height;let a=0,lo=0,hi=255,acc=0;
  for(;lo<255;lo++){acc+=hist[lo];if(acc>tot*.01)break}
  acc=0;for(hi=255;hi>0;hi--){acc+=hist[hi];if(acc>tot*.01)break}
  const rg=Math.max(40,hi-lo);
  for(let i=0;i<p.length;i+=4){const v=Math.max(0,Math.min(255,((p[i]-lo)*255/rg)|0));p[i]=p[i+1]=p[i+2]=v}
  x.putImageData(im,0,0);return cv;
}
/* تحويل لأبيض/أسود بعتبة محلية (متوسط الجوار): يُزيل زخرفة وخلفية البطاقة ويُبقي الحروف والأرقام */
function binCv(cv){
  const w=cv.width,h=cv.height,im=cv.getContext('2d').getImageData(0,0,w,h),p=im.data,W1=w+1,I=new Uint32Array(W1*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=p[(y*w+x)*4];I[(y+1)*W1+x+1]=I[y*W1+x+1]+row}}
  const r=Math.max(12,Math.round(w/40)),o=document.createElement('canvas');o.width=w;o.height=h;
  const ox=o.getContext('2d'),oi=ox.createImageData(w,h),q=oi.data;
  for(let y=0;y<h;y++){const y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);
    for(let x=0;x<w;x++){const x0=Math.max(0,x-r),x1=Math.min(w,x+r+1),n=(x1-x0)*(y1-y0),sm=I[y1*W1+x1]-I[y0*W1+x1]-I[y1*W1+x0]+I[y0*W1+x0],k=(y*w+x)*4,v=p[k]<(sm/n)*0.86?0:255;q[k]=q[k+1]=q[k+2]=v;q[k+3]=255}}
  ox.putImageData(oi,0,0);return o;
}
/* نص الصفحة بعد استبعاد الأسطر الضعيفة جداً (غالباً ضجيج من الزخرفة) */
const txtOf=d=>{const L=linesOf(d);if(!L||!L.length)return d.text||'';const k=L.filter(l=>(l.text||'').trim()&&(l.confidence==null||l.confidence>=28));return (k.length?k:L).map(l=>(l.text||'').replace(/\s+$/,'')).join('\n')};
const cropCv=(cv,fx,fy,fw,fh,minW)=>{
  const sx=Math.round(cv.width*fx),sy=Math.round(cv.height*fy),sw=Math.round(cv.width*fw),sh=Math.round(cv.height*fh),k=Math.max(1,minW/sw);
  const o=document.createElement('canvas');o.width=Math.round(sw*k);o.height=Math.round(sh*k);
  o.getContext('2d').drawImage(cv,sx,sy,sw,sh,0,0,o.width,o.height);return o;
};
const score=r=>(r.nidValid?3:0)+(r.name?2:0)+(r.job?1:0)+(r.addr.raw?2:0);

async function readCanvas(w,cv,say){
  const bv=binCv(cv),AR=t=>(String(t||'').match(/[\u0621-\u064A]/g)||[]).length;
  /* كل سطر من الاسم والعنوان يُقرأ منفرداً (سطر واحد) من منطقته في وجه البطاقة الحديثة */
  const strips=[[.255,.095],[.335,.105],[.450,.105],[.535,.105]];
  const lines=[];
  for(let i=0;i<strips.length;i++){
    say(i<2?'قراءة الاسم':'قراءة العنوان',i/strips.length);
    const [y,h]=strips[i];let best='';
    for(const src of [bv,cv]){
      const d=await recog(w,cropCv(src,.38,y,.60,h,1400),{tessedit_pageseg_mode:'7'});
      const t=(d.text||'').trim();if(AR(t)>AR(best))best=t;
      if(AR(best)>=4)break;
    }
    lines.push(best);
  }
  /* سطر رقم وهمي فقط ليعرف المحلل أن ما فوقه اسم وعنوان؛ الرقم القومي يكتبه المستخدم */
  let r=PRS.parseCard(lines.join('\n')+'\n0000000000');
  r.nid='';r.nidValid=false;r.nidCands=[];
  let raw='— قراءة الأسطر —\n'+lines.map((l,i)=>(i+1)+') '+l).join('\n');
  /* احتياطي لبطاقة بتصميم مختلف: قراءة البطاقة كاملة */
  if(!r.name){
    say('قراءة البطاقة كاملة',0);
    const d2=await recog(w,bv,{tessedit_pageseg_mode:'6'}),t2=txtOf(d2),r2=PRS.parseCard(t2);
    if(score(r2)>score(r))r=r2;r.nid='';r.nidValid=false;r.nidCands=[];
    raw+='\n\n— قراءة البطاقة كاملة —\n'+t2;
  }
  r.raw=raw;
  return r;
}
const thumb=cv=>{const o=document.createElement('canvas'),k=Math.min(1,1000/cv.width);o.width=Math.round(cv.width*k);o.height=Math.round(cv.height*k);o.getContext('2d').drawImage(cv,0,0,o.width,o.height);return o.toDataURL('image/jpeg',.82)};

/* يقرأ صفحات (وجه/ظهر) ويدمج النتائج */
A.ocrReadPages=async function(pages,say){
  const w=await engine(say),results=[],prev=[];
  for(let i=0;i<pages.length;i++){
    const tag=pages.length>1?'الصفحة '+(i+1)+' من '+pages.length+' — ':'';
    const sy=(s,p)=>say(tag+s,p);
    let cv=await prepCard(pages[i]),r=await readCanvas(w,cv,sy);
    if(score(r)<4){ /* ربما مقلوبة: جرّب 180° ثم 90° */
      for(const deg of [180,90]){
        sy('تجربة تدوير الصورة',0);const c2=rotCv(cv,deg),r2=await readCanvas(w,c2,sy);
        if(score(r2)>score(r)){r=r2;cv=c2}
        if(score(r)>=4)break;
      }
    }
    results.push(r);prev.push(thumb(cv));
  }
  return{res:PRS.merge(results),previews:prev};
};

/* ======================================================================
   3) المسح الضوئي (نفس سلوك النسخة السابقة) + OCR
   ====================================================================== */
async function scanPages(mode){
  if(!window.desk){toast('المسح الضوئي متاح في نسخة البرنامج على سطح المكتب (exe) فقط. هنا اختر الملف من جهازك.');return[]}
  if(scBusy&&Date.now()-scBusy<150000){toast('المسح قيد التنفيذ، انتظر النتيجة (حتى دقيقتين) ثم حاول مرة أخرى');return[]}
  scBusy=Date.now();const adf=mode=='adf',pages=[];
  try{for(;;){
    toast('جارٍ المسح الضوئي… لا تغلق النافذة (قد يستغرق حتى دقيقة)',1);
    const r=await desk.scan({adf});if(r.cancel)break;
    if(r.err){toast('لم يتم المسح: '+r.err);scBusy=0;if(!pages.length&&await askYN(r.err+'\n\nهل تريد جلب آخر ملف ممسوح بتطبيق HP Scan من مجلد المسح بدلًا من ذلك؟','جلب آخر ملف','لا'))scanLatest();break}
    (r.pages||[]).forEach(p=>pages.push(u8(p)));
    if(adf)break;
    if(!(await askYN('تم مسح '+pages.length+' صفحة.\nهل تريد مسح صفحة أخرى (مثل ظهر البطاقة) وإضافتها لنفس الملف (PDF)؟','مسح صفحة أخرى','إنهاء')))break;
  }}catch(e){toast('تعذر تشغيل المسح الضوئي')}
  scBusy=0;return pages;
}
function packScan(pages){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  SC.push(pdfFromJpegs(pages,`scan-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.pdf`));
  scl();
}
/* أين سنكتب البيانات المستخرجة؟ موظف مفتوح في «المستندات»، أو نموذج فيه حقول الموظف */
A.ctx={emp:null};
const ocrTarget=()=>{
  if($('dk')&&A.ctx.emp){const e=S.emps.find(x=>x.id==A.ctx.emp);if(e)return{type:'emp',e}}
  if($('f_nid')||$('f_name'))return{type:'form'};
  return null;
};
scanDoc=async function(mode){
  const pages=await scanPages(mode);if(!pages.length)return;
  packScan(pages);toast('تم تجميع '+pages.length+' صفحة في ملف PDF واحد. اضغط «حفظ» لإضافته.',1);
  const t=ocrTarget();if(!t)return;
  if(t.type==='emp'){if(/بطاقة/.test($('dk').value))await A.ocrRun(pages)}
  else if(await askYN('هل المستند الممسوح بطاقة رقم قومي؟\nيمكن قراءة بياناتها تلقائياً (الاسم، الرقم القومي، العنوان) ووضعها في الحقول.','قراءة بيانات البطاقة','لا، مستند عادي'))await A.ocrRun(pages);
};
A.ocrScan=async function(){
  const t=ocrTarget();if(!t)return toast('افتح بطاقة موظف أو نموذج موظف أولاً');
  const pages=await scanPages('flat');if(!pages.length)return;
  packScan(pages);const k=$('dk');if(k)k.value='بطاقة الرقم القومي';
  toast('تم مسح '+pages.length+' صفحة، جارٍ قراءة البطاقة…',1);await A.ocrRun(pages);
};
A.ocrFile=function(){
  const t=ocrTarget();if(!t)return toast('افتح بطاقة موظف أو نموذج موظف أولاً');
  const go=async files=>{
    const imgs=files.filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|bmp|webp)$/i.test(f.name));
    if(!imgs.length)return toast('اختر صورة للبطاقة (JPG أو PNG). ملفات PDF غير مدعومة في القراءة.');
    const pages=[];for(const f of imgs.slice(0,4))pages.push(new Uint8Array(await f.arrayBuffer()));
    await A.ocrRun(pages);
  };
  /* صور مختارة بالفعل في خانة الملفات أو ممسوحة */
  const picked=[...document.querySelectorAll('#modal input[type=file]')].flatMap(i=>[...i.files]).concat(SC);
  if(picked.some(f=>/^image\//.test(f.type)))return go(picked);
  const i=document.createElement('input');i.type='file';i.accept='image/*';i.multiple=true;i.onchange=()=>go([...i.files]);i.click();
};

/* ---------- شاشة التقدم ---------- */
function progress(){
  const o=document.createElement('div');o.className='ocr-ov';
  o.innerHTML=`<div class='mb ocr-pg'><h3>${ic('scan',20)} قراءة بيانات البطاقة</h3><p id=ocrs class=mut>جارٍ التجهيز…</p><div class=prog style='margin:12px 0 4px'><i id=ocrb style='width:6%'></i></div><small class=mut>أول مرة قد تستغرق وقتاً أطول لتجهيز المحرك. لا تغلق النافذة.</small></div>`;
  document.body.appendChild(o);
  return{set(s,p){const a=o.querySelector('#ocrs'),b=o.querySelector('#ocrb');if(a)a.textContent=s+(p?' — '+Math.round(p*100)+'٪':'…');if(b&&p!=null)b.style.width=Math.max(6,Math.round(p*100))+'%'},close(){o.remove()}};
}
A.ocrRun=async function(pages){
  if(A.ocrBusy)return toast('قراءة البطاقة قيد التنفيذ');
  A.ocrBusy=1;const pg=progress();
  try{const out=await A.ocrReadPages(pages,(s,p)=>pg.set(s,p));pg.close();A.ocrReview(out)}
  catch(e){pg.close();console.error(e);toast('تعذرت قراءة البطاقة: '+((e&&e.message)||e))}
  finally{A.ocrBusy=0;try{if(window.desk&&desk.refocus)desk.refocus()}catch(x){}}
};

/* ---------- شاشة المراجعة (نافذة مستقلة حتى لا تفقد الملف الممسوح) ---------- */
const FLD=[['name','الاسم'],['nid','الرقم القومي'],['job','الوظيفة'],['addr_b','محل الإقامة: عقار رقم'],['addr_s','الشارع'],['addr_v','القرية'],['addr_d','القسم / المركز'],['addr_g','المحافظة']];
const curVal=(t,k)=>t.type==='emp'?(t.e[k]||''):(($('f_'+k)||{}).value||'');
A.ocrReview=function({res,previews}){
  const t=ocrTarget(),vals={name:res.name,nid:res.nid,job:res.job,addr_b:res.addr.b,addr_s:res.addr.s,addr_v:res.addr.v,addr_d:res.addr.d,addr_g:res.addr.g};
  if(!Object.values(vals).some(Boolean)&&!res.raw.trim()){return toast('لم يُقرأ أي نص من الصورة. تأكد أن البطاقة واضحة ومسطّحة على الزجاج ثم أعد المسح.')}
  const info=id=>{if(!id)return '';const r=A.nid?A.nid(id):null;return r&&r.valid?`✔ ${r.gender} · مواليد ${dmy(r.birth)} · ${r.gov}`:`✖ ${r?r.error:'رقم غير صالح'}`};
  const dup=id=>{const o=id&&S.emps.find(x=>x.nid==id&&(!t||t.type!=='emp'||x.id!=t.e.id));return o?o.name:''};
  const o=document.createElement('div');o.className='ocr-ov';
  const row=([k,l])=>{const v=vals[k]||'',c=t?curVal(t,k):'',diff=c&&v&&c!==v,chk=v&&(!c||c===v||false)&&(k!=='nid'||res.nidValid);
    return `<div class=orow><label class=ock><input type=checkbox data-k='${k}' ${chk?'checked':''}> ${l}</label><input data-v='${k}' value="${esc(v)}" ${k==='nid'?'dir=ltr inputmode=numeric':''}>${diff?`<small class=ocur>الحالي: ${esc(c)} <a onclick="this.closest('.orow').querySelector('[data-k]').checked=true">استبدال</a></small>`:''}${k==='nid'?`<small class=onid data-i>${esc(info(v))}</small>${dup(v)?`<small class=owarn>⚠ هذا الرقم مسجل لموظف آخر: ${esc(dup(v))}</small>`:''}`:''}</div>`};
  o.innerHTML=`<div class='mb ocr-rv'><h3>${ic('scan',20)} البيانات المقروءة من البطاقة</h3>
<p class=mut>راجع القيم وعدّلها عند الحاجة، ثم اختر ما تريد تطبيقه. القراءة الآلية قد تخطئ في بعض الحروف أو الأرقام، فتأكد خصوصاً من الرقم القومي.</p>
${res.nidValid?'':`<p class=owarn>اكتب الرقم القومي بنفسك (لا يُقرأ آلياً)، وراجع الاسم والعنوان فالقراءة الآلية قد تخطئ في بعض الحروف.</p>`}
<div class=orv-b><div class=oprev>${previews.map(p=>`<img src="${p}" alt="" title="اضغط للتكبير">`).join('')}</div><div class=orv-f><div class=ogrid>${FLD.map(row).join('')}</div>
<details class=oraw><summary>النص الخام المقروء (للنسخ منه عند الحاجة)</summary><pre>${esc(res.raw)}</pre></details></div></div>
<div class=row><button class=btn id=oap>${ic('check',15)} ${t?(t.type==='emp'?'تطبيق على ملف الموظف':'تعبئة الحقول'):'إغلاق'}</button><button class='btn s' id=ocn>إلغاء</button></div></div>`;
  document.body.appendChild(o);
  o.querySelectorAll('.oprev img').forEach(im=>im.onclick=()=>{const z=document.createElement('div');z.className='ocr-zoom';z.innerHTML='<img src="'+im.src+'">';z.onclick=()=>z.remove();document.body.appendChild(z)});
  setTimeout(()=>{const f=[...o.querySelectorAll('[data-v]')].find(x=>!x.value);if(f)f.focus()},50);
  const ni=o.querySelector('[data-v=nid]');
  ni.oninput=()=>{const v=PRS.dig(ni.value).replace(/\D/g,'');o.querySelector('[data-i]').textContent=info(v.length===14?v:'')||(v?v.length+' من 14 رقماً':'')};
  const done=()=>{o.remove();try{if(window.desk&&desk.refocus)desk.refocus()}catch(e){}};
  o.querySelector('#ocn').onclick=done;
  o.querySelector('#oap').onclick=()=>{
    if(!t)return done();
    const pick={};FLD.forEach(([k])=>{const c=o.querySelector(`[data-k=${k}]`);if(c&&c.checked){let v=o.querySelector(`[data-v=${k}]`).value.trim();if(k==='nid')v=PRS.dig(v).replace(/\D/g,'');if(v)pick[k]=v}});
    const n=Object.keys(pick).length;if(!n)return toast('لم تحدد أي حقل للتطبيق');
    if(pick.nid&&pick.nid.length!==14)return toast('الرقم القومي يجب أن يكون 14 رقماً');
    if(t.type==='emp'){
      Object.assign(t.e,pick);lg('قراءة بطاقة (OCR)',t.e.name,t.e.id);save();go(cur);
    }else{
      Object.keys(pick).forEach(k=>{const el=$('f_'+k);if(el){el.value=pick[k];el.dispatchEvent(new Event('input',{bubbles:true}))}});
    }
    done();toast('تم تطبيق '+n+' حقل'+(t.type==='form'?'. راجعها ثم اضغط «حفظ».':''),1);
  };
};

/* ---------- أزرار القراءة داخل شاشات المستندات والنماذج ---------- */
function addOcrButtons(){
  try{
    const m=document.querySelector('#modal .mb');if(!m)return;
    const b=m.querySelector("button[onclick^=\"scanDoc('flat')\"]");if(!b||m.querySelector('.ocr-btns'))return;
    if(!(m.querySelector('#dk')||m.querySelector('#f_nid')||m.querySelector('#f_name')))return;
    const w=document.createElement('span');w.className='ocr-btns';
    w.innerHTML=`<button type=button class='btn s' title='مسح البطاقة ضوئياً ثم قراءة بياناتها' onclick=a9.ocrScan()>${ic('scan',16)} قراءة بطاقة (ماسح)</button><button type=button class='btn s' title='قراءة بيانات بطاقة من صورة' onclick=a9.ocrFile()>${ic('eye',16)} قراءة من صورة</button>`;
    b.parentNode.appendChild(w);
  }catch(e){}
}
{const _docs=docs;docs=function(id){A.ctx.emp=id;_docs.apply(this,arguments);addOcrButtons()}}
{const _form=form;form=function(){A.ctx.emp=null;_form.apply(this,arguments);addOcrButtons()}}
})();

/* Pure calculation/import helpers. No credentials or embedded sales data. */
(function(root){'use strict';
const SUM=a=>a.reduce((s,n)=>s+(Number.isFinite(n)?n:0),0);
const CUT={manager:[50,80,100,120,200],supervisor:[80,90,100,120,200]};
const isCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
const isDate=d=>/^2026-11-(0[1-9]|[12]\d|30)$/.test(d||'');
function tier(n,t,prices,role='manager'){
 const cuts=CUT[role];if(!isCount(n)||!isCount(t)||t===0||!Array.isArray(prices)||prices.length!==5)return {valid:false,amount:null,rate:null,label:'待資料'};
 let k=-1;cuts.forEach((c,i)=>{if(n*100>=t*c)k=i;});
 const amount=k<0?0:prices[k],label=k<0?'未達'+cuts[0]+'%':k===4?'≥200%':cuts[k]+'%～<'+cuts[k+1]+'%';
 const next=k===4?null:Math.ceil(t*cuts[k+1]/100);
 let nextAmount=amount,nextLabel='最高級距';if(next!==null){let idx=-1;cuts.forEach((c,i)=>{if(next*100>=t*c)idx=i;});nextAmount=prices[idx];nextLabel=idx===4?'≥200%':cuts[idx]+'%～<'+cuts[idx+1]+'%';}
 return {valid:true,amount,rate:n/t,label,index:k,next,nextLabel,add:next===null?null:next-n,gain:nextAmount-amount,under:k<0};
}
function calculations(defs,state,store=-1,model=-1){
 const ids=model<0?defs.models.map((_,j)=>j):[model],role=store<0?'supervisor':'manager';
 const cells=ids.map(j=>{
  let n=null,t=null,conflict=false,provisional=false;
  if(store>=0){const fresh=isDate(state.asOf)&&state.rowDates[store]===state.asOf;n=fresh?state.actual[store][j]:null;t=state.targets[store][j];provisional=state.origins[store][j]!=='report';}
  else{const fresh=isDate(state.asOf)&&defs.stores.every((_,i)=>state.rowDates[i]===state.asOf&&isCount(state.actual[i][j]));n=fresh?SUM(state.actual.map(a=>a[j])):null;const ts=state.targets.map(a=>a[j]);t=ts.every(x=>isCount(x)&&x>0)?SUM(ts):null;provisional=state.origins.some(a=>a[j]!=='report');const raw=state.region;if(fresh&&raw?.asOf===state.asOf){if(raw.values?.[j]!=null&&raw.values[j]!==n)conflict=true;if(raw.targets?.[j]!=null&&raw.targets[j]!==t)conflict=true;}}
  const calculation=tier(conflict?null:n,t,defs.models[j][role],role);return {j,n,t,conflict,provisional,...calculation};
 });
 const complete=cells.every(c=>c.valid),known=cells.filter(c=>c.valid),target=cells.every(c=>isCount(c.t)&&c.t>0)?SUM(cells.map(c=>c.t)):null;
 return {role,cells,complete,filled:known.length,size:ids.length,target,actual:complete?SUM(cells.map(c=>c.n)):null,knownActual:SUM(known.map(c=>c.n)),rate:complete?SUM(cells.map(c=>c.n))/target:null,amount:complete?SUM(known.map(c=>c.amount)):null,knownAmount:SUM(known.map(c=>c.amount)),qualified:known.filter(c=>!c.under).length,provisional:cells.some(c=>c.provisional),conflict:cells.some(c=>c.conflict)};
}
function raw(v){if(v&&typeof v==='object'&&v.formula){if(v.cached===undefined||v.cached==='')throw Error('Excel公式未保存結果，請在Excel重算並存檔。');return v.cached;}return v;}
const norm=v=>String(raw(v)??'').normalize('NFKC').toLowerCase().replace(/[\s\u00a0_]/g,'').replace(/[／&＆、]/g,'/');
const name=v=>norm(v).replace(/^(上線數|空機數)\d+/,'').replace(/samsunggalaxy|samsung|google|oppo|vivo/g,'');
function modelKey(value,defs){
 const v=name(value);const direct=defs.models.findIndex(m=>[name(m.name),name(m.full)].includes(v));if(direct>=0)return {j:direct,part:'full'};
 if(['pixel11pro/proxl/11profold/10a','pixel11pro/11proxl/11profold/10a','pixel11pro/11proxl/11profold/pixel10a','pixel10a/pixel11pro/11proxl/11profold'].includes(v))return {j:0,part:'full'};
 if(v==='pixel10a')return {j:0,part:'10a'};
 if(['pixel11pro/11proxl/11profold','pixel11pro/proxl/profold','pixel11pro系列'].includes(v))return {j:0,part:'pro'};
 if(['s26/s26+','s26','s26系列'].includes(v))return {j:-2,part:'ambiguous'};
 const aliases=[['reno16f',1],['v80lite',2],['v80l',2],['a6x/a7pro',3],['a6x6g/128g/a7pro',3],['a57',4],['s26256g',5],['s26256gb',5],['pixel11',6],['zflip8/zfold8/zfold8ultra',7],['zfold8ultra/zfold8/zflip8',7],['zflip8/fold8/fold8ultra',7],['pixel10',8],['v80',9],['x500',10]];
 const found=aliases.find(x=>x[0]===v);return found?{j:found[1],part:'full'}:{j:-1,part:''};
}
function numeric(v,integer=false){v=raw(v);if(v==null||String(v).trim()==='')return null;const text=String(v).normalize('NFKC').replace(/[,\s$＄]/g,'');if(!/^\d+(\.\d+)?$/.test(text))throw Error('數字欄含無法辨識內容：'+String(v).slice(0,30));const n=Number(text);if(!Number.isFinite(n)||n>1e10||(integer&&!isCount(n)))throw Error('台數須為0～100000非負整數。');return n;}
function rate(v){v=raw(v);if(v==null||String(v).trim()==='')return null;const s=String(v).trim();return s.endsWith('%')?numeric(s.slice(0,-1))/100:numeric(s);}
function identity(row,stop,defs){const pre=row.slice(0,stop).map(norm),codes=pre.filter(x=>/^dnb\d+$/.test(x)),n=defs.stores.map((s,i)=>pre.some(x=>[norm(s.name),norm(s.short)].includes(x))?i:-1).filter(i=>i>=0);if(codes.length>1||n.length>1)throw Error('同列含多間店或店碼。');const c=codes.length?defs.stores.findIndex(s=>norm(s.id)===codes[0]):-1;if(c>=0&&n.length&&c!==n[0])throw Error('門市名稱與代碼不一致。');if(c>=0||n.length)return c>=0?c:n[0];return !codes.length&&pre.includes(norm('北一二C'))?9:-1;}
function summaryKey(v){const n=norm(v);if(n==='實際總獎金')return 'actualBonus';if(n.startsWith('推估原始總獎金'))return 'projectedBonus';if(n==='排名')return 'rank';if(n.startsWith('領獎與否'))return 'eligible';return null;}
function analyse(sheets,defs,filename=''){
 const n=defs.models.length,errors=[],warnings=[],seen=new Map(),parts=new Map(),reports={},rawRegion={values:Array(n).fill(null),targets:Array(n).fill(null),rates:Array(n).fill(null)},touched=new Set(),periods=new Set();let regionSeen=false;
 const periodScan=s=>{for(const m of String(s).matchAll(/(?:2026[\/-]?(10|11)|2026年(10|11)月|115[\/-](10|11)|(?:^|\s)(10|11)月份)/g))periods.add('2026-'+(m[1]||m[2]||m[3]||m[4]));};periodScan(filename);
 function summary(row,cols,id){const rec={actualBonus:null,projectedBonus:null,rank:null,eligible:null};for(const [k,c] of Object.entries(cols)){const v=raw(row[c]);if(k==='eligible'){const y=v==null?'':String(v).trim().toUpperCase();if(y&&!['Y','N'].includes(y))throw Error('領獎欄應為Y或N。');rec[k]=y||null;}else{rec[k]=numeric(v);if(k==='rank'&&rec[k]!==null&&(!Number.isInteger(rec[k])||rec[k]<1))throw Error('排名須為正整數。');}}
  if(Object.keys(cols).length){if(reports[id]&&JSON.stringify(reports[id])!==JSON.stringify(rec))throw Error('同店跨列／跨頁的原表總額不同，請只保留正確頁籤。');reports[id]=rec;if(id<9)touched.add(id);else regionSeen=true;}}
 function add(id,desc,row){const value=numeric(row[desc.a],true),target=desc.t>=0?numeric(row[desc.t],true):null,projected=desc.r>=0?rate(row[desc.r]):null,key=id+':'+desc.j+':'+desc.part;const u={i:id,j:desc.j,part:desc.part,value,target,rate:projected};if(seen.has(key)){const old=seen.get(key);if(JSON.stringify(old)!==JSON.stringify(u))throw Error('同店同機款出現不同累計數／目標，不重複加總。');return;}seen.set(key,u);if(id<9)touched.add(id);else regionSeen=true;}
 for(const sheet of sheets){if(/暫估|建議|試算|獎金級距|獎金表|原始目標/.test(sheet.name||'')){warnings.push('略過規劃／目標頁：'+sheet.name);continue;}let cols=[],summaryCols={},stop=0,long=null;
  for(let ri=0;ri<sheet.rows.length;ri++){const row=sheet.rows[ri]||[];try{
   if(ri<12)periodScan(row.map(x=>String(raw(x)??'')).join(' '));
   const heads=[];row.forEach((v,c)=>{if(/^(上線數|空機數)_?\d+_/i.test(String(raw(v)??'').normalize('NFKC').replace(/\s/g,''))){const k=modelKey(v,defs);heads.push({c,...k,online:norm(v).startsWith('上線數')});}});
   if(heads.length){cols=[];long=null;summaryCols={};stop=Math.min(...heads.map(x=>x.c));for(let k=0;k<heads.length;k++){const hd=heads[k];if(!hd.online)continue;if(hd.j===-2){warnings.push('S26／S26+混合實績未歸入S26 256G，需提供容量拆分欄。');continue;}if(hd.j<0)continue;const end=heads[k+1]?.c??row.length;let a=-1,t=-1,r=-1;for(let rr=ri+1;rr<=Math.min(ri+4,sheet.rows.length-1);rr++){const sub=sheet.rows[rr]||[];if(sub.some(v=>norm(v).startsWith('上線數')))break;for(let c=hd.c;c<end;c++){const s=norm(sub[c]);if(s==='實際數'&&a<0)a=c;if(s==='目標數'&&t<0)t=c;if(s==='推估達成率'&&r<0)r=c;}}if(a<0)throw Error('找不到'+defs.models[hd.j].name+'的實際數子表頭。');cols.push({...hd,a,t,r});}continue;}
   const ss={};row.forEach((v,c)=>{const k=summaryKey(v);if(k)ss[k]=c;});if(Object.keys(ss).length>=2){summaryCols=ss;if(!cols.length)stop=Math.min(...Object.values(ss));continue;}
   const normalized=row.map(norm),sc=normalized.findIndex(x=>['門市','門市名稱','營業點名稱','店點'].includes(x)),cc=normalized.findIndex(x=>['門市代碼','代碼','營業點代碼'].includes(x));
   if(sc>=0||cc>=0){const mc=normalized.findIndex(x=>['競賽組','競賽機型','機型','競賽機款'].includes(x)),ac=normalized.findIndex(x=>['實際數','有效上線','累計有效上線','本月累計上線','實績'].includes(x)),tc=normalized.findIndex(x=>['目標','目標數','月目標'].includes(x));
    if(mc>=0&&ac>=0){long={sc,cc,mc,ac,tc};cols=[];continue;}
    const wide=row.map((v,c)=>({...modelKey(v,defs),c})).filter(x=>x.j>=0);if(wide.length>=2){long=null;cols=wide.map(x=>({...x,a:x.c,t:-1,r:-1}));stop=Math.min(...wide.map(x=>x.c));continue;}}
   if(long){const id=identity([row[long.cc],row[long.sc]],2,defs);if(id<0)continue;const k=modelKey(row[long.mc],defs);if(k.j===-2){warnings.push('S26混合組未計入256G。');continue;}if(k.j<0)continue;add(id,{...k,a:long.ac,t:long.tc,r:-1},row);continue;}
   if(!cols.length&&!Object.keys(summaryCols).length)continue;const id=identity(row,stop,defs);if(id<0)continue;summary(row,summaryCols,id);for(const c of cols)add(id,c,row);
  }catch(e){errors.push((sheet.name||'工作表')+' 第'+(ri+1)+'列：'+e.message);}}
 }
 for(const u of seen.values()){const key=u.i+':'+u.j;if(!parts.has(key))parts.set(key,[]);parts.get(key).push(u);}
 const updates=[];for(const list of parts.values()){const full=list.find(x=>x.part==='full');let u;if(full&&list.length>1){errors.push('Pixel合組與拆分同時出現，請只保留一種，避免重複認列。');continue;}if(full)u=full;else{const a=list.find(x=>x.part==='10a'),b=list.find(x=>x.part==='pro');if(!a||!b){warnings.push('Pixel Pro／10a拆分欄未齊，合組不自行補0。');continue;}u={...a,part:'full',value:a.value!==null&&b.value!==null?a.value+b.value:null,target:a.target!==null&&b.target!==null?a.target+b.target:null,rate:null};warnings.push('Pixel 10a與Pro組已合併；原推估率不相加。');}
  if(u.i===9){rawRegion.values[u.j]=u.value;rawRegion.targets[u.j]=u.target;rawRegion.rates[u.j]=u.rate;}else updates.push(u);
 }
 if(periods.size&&(!periods.has('2026-11')||periods.size>1))errors.push('檔案含10月或混合月份標記，不可套進11月。');
 if(!touched.size)errors.push('未辨識九店資料；請上傳11月原始報表，或門市／機型／實際數／目標數的長表。');
 if(touched.size&&touched.size<9)warnings.push('僅'+touched.size+'店；其他店保留舊日期，不混算全區。');
 return {updates,reports,touched:[...touched],region:regionSeen?{actualBonus:null,projectedBonus:null,rank:null,eligible:null,...reports[9],...rawRegion}:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)],periods:[...periods]};
}
function apply(previous,parsed,date,file){if(!isDate(date)||parsed.errors.length)throw Error('日期或資料不正確。');const s=JSON.parse(JSON.stringify(previous));for(const i of parsed.touched){s.actual[i]=Array(s.targets[i].length).fill(null);s.rates[i]=Array(s.targets[i].length).fill(null);s.rowDates[i]=date;s.report[i]={actualBonus:null,projectedBonus:null,rank:null,eligible:null,...parsed.reports[i],asOf:date};}for(const u of parsed.updates){s.actual[u.i][u.j]=u.value;s.rates[u.i][u.j]=u.rate;if(u.target!==null){s.targets[u.i][u.j]=u.target;s.origins[u.i][u.j]='report';}}s.asOf=date;s.region=parsed.region?{...parsed.region,asOf:date}:null;s.source={file};return s;}
const api={tier,calculations,modelKey,analyse,apply,isDate};root.NBonus=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

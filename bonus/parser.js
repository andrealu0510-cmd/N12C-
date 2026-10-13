'use strict';
window.makeBonusParser=function(D,state){
const clean=s=>String(s??'').normalize('NFKC').replace(/\s|\u00a0/g,'').replace(/[／&＆、]/g,'/').toLowerCase();
const validCount=n=>n===null||(Number.isSafeInteger(n)&&n>=0&&n<=100000);
function parseCount(v){if(v==null||String(v).trim()==='')return {value:null};const text=String(v).normalize('NFKC').trim().replace(/,/g,'');if(!/^\d+(\.0+)?$/.test(text))return {error:'僅可填0或非負整數；不可填負數、小數或文字。'};const n=Number(text);if(!validCount(n))return {error:'台數需為0～100000的整數。'};return {value:n};}
function parseCsv(text){text=text.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',q=false;const delimiter=text.split(/\r?\n/).slice(0,20).some(l=>l.includes('\t'))?'\t':',';for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++;}else q=!q;}else if(c===delimiter&&!q){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}if(q)throw Error('CSV引號未閉合，請重新另存CSV。');if(cell!==''||row.length){row.push(cell);rows.push(row);}return rows;}
// Read saved cell values only. Never execute workbook formulas, macros or HTML.
async function readXlsx(buffer){const v=new DataView(buffer),bytes=new Uint8Array(buffer);let eocd=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65558);p--){if(v.getUint32(p,true)===0x06054b50){eocd=p;break;}}if(eocd<0)throw Error('檔案不是有效xlsx ZIP；加密檔或xls不支援。');const entries=v.getUint16(eocd+10,true),start=v.getUint32(eocd+16,true);if(entries>2000||start>=bytes.length)throw Error('檔案結構超過支援範圍。');let offset=start,totalSize=0;const paths={};const decoder=new TextDecoder('utf-8');for(let k=0;k<entries;k++){if(v.getUint32(offset,true)!==0x02014b50)throw Error('xlsx目錄損毀。');const flags=v.getUint16(offset+8,true),method=v.getUint16(offset+10,true),size=v.getUint32(offset+20,true),raw=v.getUint32(offset+24,true),nl=v.getUint16(offset+28,true),xl=v.getUint16(offset+30,true),cl=v.getUint16(offset+32,true),loc=v.getUint32(offset+42,true),name=decoder.decode(bytes.subarray(offset+46,offset+46+nl));if(flags&1)throw Error('不支援加密檔案。');totalSize+=raw;if(totalSize>80e6)throw Error('解壓後檔案過大，請使用範本或只保留實績表。');paths[name]={method,size,raw,loc};offset+=46+nl+xl+cl;}
async function text(path){const f=paths[path];if(!f)return '';const p=f.loc;if(v.getUint32(p,true)!==0x04034b50)throw Error('xlsx內容標頭損毀。');const begin=p+30+v.getUint16(p+26,true)+v.getUint16(p+28,true),comp=bytes.slice(begin,begin+f.size);let out;if(f.method===0)out=comp;else if(f.method===8){try{const stream=new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));out=new Uint8Array(await new Response(stream).arrayBuffer());}catch(err){throw Error('此瀏覽器無法解壓xlsx，請以新版Chrome／Edge開啟，或改用CSV。');}}else throw Error('不支援的xlsx壓縮方式。');if(out.length>80e6||out.length!==f.raw)throw Error('xlsx內容長度異常。');return decoder.decode(out);}
const xml=t=>{const d=new DOMParser().parseFromString(t,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('xlsx內部XML無法解析。');return d;};const elems=(el,tag)=>Array.from(el.getElementsByTagNameNS('*',tag));const sharedText=await text('xl/sharedStrings.xml');const shared=sharedText?elems(xml(sharedText),'si').map(si=>elems(si,'t').map(t=>t.textContent).join('')):[];const wbText=await text('xl/workbook.xml');if(!wbText)throw Error('找不到Excel工作簿。');const rels=xml(await text('xl/_rels/workbook.xml.rels'));const relmap={};elems(rels,'Relationship').forEach(r=>{relmap[r.getAttribute('Id')]=r.getAttribute('Target');});const sheets=[];for(const sh of elems(xml(wbText),'sheet')){const name=sh.getAttribute('name'),rid=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');let path=relmap[rid];if(!path)continue;path=path.startsWith('/')?path.slice(1):'xl/'+path;path=path.replace(/^xl\/xl\//,'xl/');const raw=await text(path);if(!raw)continue;const doc=xml(raw),data=[];const xrows=elems(doc,'row');if(xrows.length>25000)throw Error('資料超過25000列，請先篩出九店。');for(const row of xrows){const vals=[];for(const c of elems(row,'c')){const ref=c.getAttribute('r')||'',col=ref.match(/^[A-Z]+/);if(!col)continue;let idx=0;for(const ch of col[0])idx=idx*26+ch.charCodeAt(0)-64;idx--;if(idx>4095)continue;const type=c.getAttribute('t'),formula=elems(c,'f').length>0,val=elems(c,'v')[0]?.textContent;let valout='';if(formula){valout={formula:true,cached:val??''};}else if(type==='s')valout=shared[Number(val)]??'';else if(type==='inlineStr')valout=elems(c,'t').map(t=>t.textContent).join('');else if(type==='b')valout=val==='1'?'TRUE':'FALSE';else valout=val??elems(c,'t').map(t=>t.textContent).join('');vals[idx]=valout;}const rn=Number(row.getAttribute('r'));if(rn>30000)throw Error('Excel超過30000列，請篩出必要報表。');data[(rn>0?rn:data.length+1)-1]=vals;}sheets.push({name,rows:Array.from({length:data.length},(_,i)=>data[i]||[])});}return sheets;}
const MODEL_ALIASES=D.models.map(m=>[m.name,m.full].map(clean));MODEL_ALIASES[0].push(clean('Samsung A57'));MODEL_ALIASES[4].push(clean('OPPO A6x／A7 Pro'),clean('OPPO A6x 6G/128G & OPPO A7 Pro'));MODEL_ALIASES[5].push(clean('三星摺疊組'),clean('Samsung Galaxy Z Fold8 Ultra/Z Fold8/Z Flip8'));MODEL_ALIASES[7].push(clean('Pixel 11 Pro系列'),clean('Google Pixel 11 Pro/11 Pro XL/11 Pro Fold'));
function modelIndex(name){const n=clean(name);return MODEL_ALIASES.findIndex(a=>a.includes(n));}
function storeIndex(code,name){const c=clean(code),n=clean(name),ci=D.stores.findIndex(s=>clean(s.id)===c),ni=D.stores.findIndex(s=>[s.name,s.short].map(clean).includes(n));if(ci>=0&&ni>=0&&ci!==ni)return -2;return ci>=0?ci:ni;}
function analyzeSheet(sheet){const native=analyzeNative(sheet);if(native)return native;const rows=sheet.rows;let header=-1,si=-1,ci=-1,mi=-1,ai=-1,cols=[],layout='';for(let k=0;k<Math.min(35,rows.length);k++){const r=rows[k].map(v=>typeof v==='object'?'':clean(v));const sidx=r.findIndex(v=>['門市','門市名稱','營業點名稱','店點','營業點'].includes(v)),cidx=r.findIndex(v=>['門市代碼','營業點代碼','代碼','店點代碼'].includes(v)),midx=r.findIndex(v=>['競賽組','競賽機型','機型','競賽機款'].includes(v)),aidx=r.findIndex(v=>['目前有效上線【手動填入】','目前有效上線','有效上線','有效上線數','本月累計有效上線','累計有效上線','實際數','實績','本月累計上線','實績上線數'].includes(v));const c=r.map(v=>modelIndex(v));if((sidx>=0||cidx>=0)&&midx>=0&&aidx>=0){header=k;si=sidx;ci=cidx;mi=midx;ai=aidx;layout='long';break;}if((sidx>=0||cidx>=0)&&c.filter(x=>x>=0).length>=3){header=k;si=sidx;ci=cidx;cols=c;layout='wide';break;}}
if(header<0)return {recognized:false,reason:'未找到門市＋競賽組＋有效上線欄位，或九組橫式表頭。'};if(/535|537|558|目標|方案|建議|級距|區域檢核|試算說明/.test(sheet.name))return {recognized:false,reason:'這是目標／方案／規則頁，不可匯入為實績。'};const updates=[],errors=[],seen=new Set();let blanks=0,skipped=0,formulaSkipped=0;function add(i,j,val,rowno){const key=i+':'+j;if(seen.has(key)){errors.push(`第${rowno}列：${D.stores[i].name}／${D.models[j].name}重複，累計資料不可自動相加。`);return;}seen.add(key);if(val&&typeof val==='object'&&val.formula){formulaSkipped++;return;}const p=parseCount(val);if(p.error){errors.push(`第${rowno}列：${D.stores[i].name}／${D.models[j].name}，${p.error}`);return;}if(p.value===null){blanks++;return;}updates.push({i,j,value:p.value,old:state.actual[i][j]});}
for(let r=header+1;r<rows.length;r++){const row=rows[r];if(row.every(x=>x===null||x===undefined||x===''))continue;const i=storeIndex(ci>=0?row[ci]:'',si>=0?row[si]:'');if(i===-2){errors.push(`第${r+1}列：門市代碼與門市名稱對應不同店點，請修正。`);continue;}if(i<0){skipped++;continue;}if(layout==='long'){const j=modelIndex(row[mi]);if(j<0){skipped++;continue;}add(i,j,row[ai],r+1);}else cols.forEach((j,c)=>{if(j>=0)add(i,j,row[c],r+1);});}
return {recognized:true,layout,updates,errors,blanks,skipped,formulaSkipped,header:header+1};}
const rawCell=v=>v&&typeof v==='object'&&v.formula?v.cached:v;
const nativeClean=v=>clean(rawCell(v));
const nativeKeys=[['a57','samsunggalaxya57','samsunga57'],['pixel10a','googlepixel10a'],['reno16f','opporeno16f'],['v80lite','vivov80lite'],['a6x/a7pro','oppoa6x6g/128g/oppoa7pro','oppoa6x/a7pro'],['zflip8/zfold8/zfold8ultra','zfold8ultra/zfold8/zflip8','samsunggalaxyzfold8ultra/zfold8/zflip8'],['s26/s26+','samsungs26/s26+'],['pixel11pro/11proxl/11profold','pixel11pro/11proxl/11profold','googlepixel11pro/11proxl/11profold'],['pixel11','googlepixel11']];
function nativeModel(v){const n=nativeClean(v).replace(/^(上線數|空機數)_?\d+_?/,'');return nativeKeys.findIndex((a,j)=>a.includes(n)||MODEL_ALIASES[j].includes(n));}
function nativeIdentity(row,stop){const cells=row.slice(0,stop).map(nativeClean),codes=cells.map((v,k)=>/^dnb\d+$/.test(v)?k:-1).filter(k=>k>=0),matches=D.stores.map((s,i)=>cells.some(v=>[s.name,s.short].map(clean).includes(v))?i:-1).filter(i=>i>=0);if(codes.length>1||matches.length>1)return {i:-2};const code=codes.length?cells[codes[0]]:'',ci=D.stores.findIndex(s=>clean(s.id)===code),ni=matches[0]??-1;if(ci>=0&&ni>=0&&ci!==ni)return {i:-2};if(ci>=0||ni>=0)return {i:ci>=0?ci:ni,code};return {i:-1,region:!code&&cells.includes(clean('北一二C'))};}
function parseRate(v){const x=rawCell(v);if(x===null||x===undefined||String(x).trim()==='')return null;const s=String(x).normalize('NFKC').replace(/[\s,]/g,'');if(/^-?\d+(\.\d+)?%$/.test(s))return Number(s.slice(0,-1))/100;if(/^-?\d+(\.\d+)?$/.test(s))return Number(s);return null;}
function parseMoney(v){const x=rawCell(v);if(x===null||x===undefined||String(x).trim()==='')return null;const n=Number(String(x).replace(/[\s,$＄]/g,''));return Number.isFinite(n)&&n>=0?n:null;}
function analyzeNative(sheet){
 const rows=sheet.rows,updates=[],errors=[],warnings=[],seen=new Map(),reportStores={},regionRows=[];
 let cols=null,summaryCols={},recognized=false,blanks=0,skipped=0,formulaCached=0,dedup=0,groupHeads=0;
 for(let r=0;r<rows.length;r++){
  const row=rows[r]||[];if(!row.some(v=>String(rawCell(v)??'').trim()))continue;
  const headings=[];row.forEach((v,c)=>{if(/^(上線數|空機數)_?\d+_/i.test(nativeClean(v)))headings.push({c,v:rawCell(v),online:nativeClean(v).startsWith('上線數'),j:nativeModel(v)});});
  if(headings.filter(h=>h.online&&h.j>=0).length>=3){
   recognized=true;groupHeads++;const next=[];summaryCols={};
   for(const h of headings.filter(h=>h.online&&h.j>=0)){
    const end=headings.find(k=>k.c>h.c)?.c??row.length;let a=-1,t=-1,p=-1;
    for(let rr=r+1;rr<=Math.min(r+4,rows.length-1);rr++){
     const sr=rows[rr]||[];if(sr.some(v=>/^(上線數|空機數)_?\d+_/i.test(nativeClean(v))))break;
     for(let c=h.c;c<end;c++){const v=nativeClean(sr[c]);if(v==='實際數'&&a<0)a=c;if(v==='目標數'&&t<0)t=c;if(v==='推估達成率'&&p<0)p=c;}
     sr.forEach((v,c)=>{const n=nativeClean(v);if(n==='實際總獎金')summaryCols.actualBonus=c;if(n.startsWith('推估原始總獎金'))summaryCols.projectedBonus=c;if(n==='排名')summaryCols.rank=c;if(n.startsWith('領獎與否'))summaryCols.eligible=c;});
     if(a>=0&&t>=0)break;
    }
    if(a<0||t<0)errors.push(`第${r+1}列 ${D.models[h.j].name}：找不到實際數／目標數子表頭，未猜測欄位。`);else next.push({...h,a,t,p});
   }
   const groupIds=next.map(c=>c.j);if(new Set(groupIds).size!==groupIds.length)errors.push(`第${r+1}列表頭有重複競賽組，請確認上線數欄位。`);
   cols=next;continue;
  }
  if(!cols?.length)continue;
  const ident=nativeIdentity(row,Math.min(...cols.map(c=>c.c)));
  if(ident.i===-2){errors.push(`第${r+1}列：門市名稱與代碼不一致或含多家店，停止匯入。`);continue;}
  if(ident.i<0){
   if(ident.region){const record={name:'北一二C',values:Array(9).fill(null),targets:Array(9).fill(null),rates:Array(9).fill(null)};for(const c of cols){record.values[c.j]=parseCount(rawCell(row[c.a])).value??null;record.targets[c.j]=parseCount(rawCell(row[c.t])).value??null;record.rates[c.j]=parseRate(row[c.p]);}for(const [k,c] of Object.entries(summaryCols))record[k]=k==='eligible'?String(rawCell(row[c])??''):parseMoney(row[c]);regionRows.push(record);}else skipped++;continue;
  }
  const i=ident.i,rec=reportStores[i]??={rates:Array(9).fill(null),values:Array(9).fill(null),targets:Array(9).fill(null)};
  for(const [k,c] of Object.entries(summaryCols))rec[k]=k==='eligible'?String(rawCell(row[c])??''):parseMoney(row[c]);
  for(const c of cols){
   const v=row[c.a],t=row[c.t],key=i+':'+c.j;
   if(v&&typeof v==='object'&&v.formula){if(v.cached===undefined||v.cached===''){errors.push(`${D.stores[i].name}／${D.models[c.j].name}：實際數公式未保存結果，請在Excel重算並存檔。`);continue;}formulaCached++;}
   if(t&&typeof t==='object'&&t.formula){if(t.cached===undefined||t.cached===''){errors.push(`${D.stores[i].name}／${D.models[c.j].name}：目標公式未保存結果。`);continue;}formulaCached++;}
   const pv=parseCount(rawCell(v)),pt=parseCount(rawCell(t));
   if(pv.error||pt.error||pt.value===0){errors.push(`${D.stores[i].name}／${D.models[c.j].name}：${pv.error||pt.error||'目標為0，沒有適用計算規則，不匯入。'}`);continue;}
   if(pv.value===null){blanks++;continue;}
   if(pt.value===null){errors.push(`${D.stores[i].name}／${D.models[c.j].name}：缺少目標數。`);continue;}
   const u={i,j:c.j,value:pv.value,old:state.actual[i][c.j],target:pt.value,oldTarget:D.stores[i].targets[c.j],rate:c.p>=0?parseRate(row[c.p]):null,row:r+1,sheet:sheet.name};
   if(seen.has(key)){const old=seen.get(key);if(old.value!==u.value||old.target!==u.target||old.rate!==u.rate)errors.push(`${D.stores[i].name}／${D.models[c.j].name}重複且值不同，不相加也不猜測採哪筆。`);else dedup++;continue;}
   seen.set(key,u);updates.push(u);rec.values[c.j]=u.value;rec.targets[c.j]=u.target;rec.rates[c.j]=u.rate;
  }
 }
 if(!recognized)return null;
 if(formulaCached)warnings.push(`${formulaCached}個欄位使用Excel已存的公式結果；網頁不執行Excel公式。`);
 if(dedup)warnings.push(`略過${dedup}個完全相同的重複店組資料，未重複加總。`);
 if(regionRows.length)warnings.push(`已辨識${regionRows.length}列督導區彙總，僅供對照，不併入九店。`);
 return {recognized:true,native:true,layout:'原始台獎報表（多列表頭）',updates,errors,warnings,blanks,skipped,formulaSkipped:0,formulaCached,dedup,header:groupHeads,reportStores,regionRows};
}
const SUMMARY_KEYS=['actualBonus','projectedBonus','rank','eligible'];
function summaryHeader(v){const n=nativeClean(v);if(n==='實際總獎金')return 'actualBonus';if(n.startsWith('推估原始總獎金'))return 'projectedBonus';if(n==='排名')return 'rank';if(n.startsWith('領獎與否'))return 'eligible';return null;}
function readSummaryCell(v,k,label,errors){
 const x=rawCell(v);
 if(v&&typeof v==='object'&&v.formula&&(x===undefined||x==='')){errors.push(`${label}：Excel公式沒有已存結果，請在Excel重新計算並存檔，未自行推算。`);return null;}
 if(x===null||x===undefined||String(x).trim()==='')return null;
 if(k==='eligible'){const y=String(x).normalize('NFKC').trim().toUpperCase();if(!['Y','N'].includes(y)){errors.push(`${label}：應為Y、N或空白，未猜測。`);return null;}return y;}
 const n=parseMoney(v);if(n===null||(k==='rank'&&(!Number.isInteger(n)||n<1))){errors.push(`${label}：不是有效的${k==='rank'?'排名':'金額'}。`);return null;}return n;
}
function summaryRecord(row,cols,label,errors){const rec={actualBonus:null,projectedBonus:null,rank:null,eligible:null};for(const k of SUMMARY_KEYS){if(cols[k]!==undefined)rec[k]=readSummaryCell(row[cols[k]],k,label+'／'+k,errors);}return rec;}
function scanSummary(sheet){
 let cols=null,recognized=false;const records={},errors=[],warnings=[],region=[];
 for(let r=0;r<sheet.rows.length;r++){
  const row=sheet.rows[r]||[],found={};row.forEach((v,c)=>{const k=summaryHeader(v);if(k)found[k]=c;});
  if(Object.keys(found).length>=2&&(found.actualBonus!==undefined||found.projectedBonus!==undefined)){cols=found;recognized=true;continue;}
  if(!cols)continue;
  const id=nativeIdentity(row,Math.min(...Object.values(cols)));if(id.i===-2){errors.push(`${sheet.name} 第${r+1}列：店名和店碼衝突。`);continue;}
  if(id.i<0&&!id.region)continue;
  const name=id.region?'北一二C':D.stores[id.i].name;
  const rec=summaryRecord(row,cols,name,errors);rec.row=r+1;rec.sheet=sheet.name;
  if(id.region){region.push(rec);continue;}
  if(records[id.i]&&SUMMARY_KEYS.some(k=>records[id.i][k]!==rec[k]))errors.push(`${name}在同頁有兩組不同總額／排名，不自動選取或加總。`);
  else records[id.i]=rec;
 }
 return {recognized,records,errors,warnings,region};
}
function combineSheets(sheets,selection='all'){
 const scans=sheets.map((s,k)=>({s,k,p:analyzeSheet(s),q:scanSummary(s)}));
 const options=scans.filter(x=>x.p?.recognized||Object.keys(x.q.records).length||x.q.region.length).map(x=>({k:x.k,name:x.s.name}));
 const chosen=selection==='all'?scans:scans.filter(x=>String(x.k)===String(selection));
 const out={updates:[],report:{},region:null,errors:[],warnings:[],options,sheets:[],selected:selection,recognized:0};const seen=new Map();
 for(const {s,p,q} of chosen){
  if(!p?.recognized&&!q.recognized)continue;out.recognized++;out.sheets.push(s.name);
  out.errors.push(...(p?.recognized?p.errors||[]:[]),...q.errors);out.warnings.push(...(p?.warnings||[]));
  for(const u of p?.updates||[]){const key=u.i+':'+u.j,prior=seen.get(key);if(prior){if(prior.value!==u.value||(prior.target!==undefined&&u.target!==undefined&&prior.target!==u.target)||(prior.rate!=null&&u.rate!=null&&prior.rate!==u.rate))out.errors.push(`${D.stores[u.i].name}／${D.models[u.j].name}跨頁值不同，請選正確頁籤。`);}else{seen.set(key,u);out.updates.push(u);}}
  for(const [i,rec] of Object.entries(q.records)){const prior=out.report[i];if(prior&&SUMMARY_KEYS.some(k=>prior[k]!==rec[k]))out.errors.push(`${D.stores[i].name}跨頁的Excel總額／排名／領獎欄不同，請選正確頁籤。`);else out.report[i]=rec;}
  for(const rec of q.region){if(out.region&&SUMMARY_KEYS.some(k=>out.region[k]!==rec[k]))out.errors.push('督導區原表總額在不同頁籤不一致，請選正確頁籤。');else out.region={...(out.region||{}),...rec};}
  for(const rec of p?.regionRows||[]){const base=out.region||{};for(const key of ['values','targets','rates']){if(base[key]&&base[key].some((v,j)=>v!==null&&rec[key]?.[j]!==null&&rec[key]?.[j]!==undefined&&v!==rec[key][j]))out.errors.push('督導區'+key+'跨頁不同，請選正確頁籤。');}out.region={...base,values:rec.values,targets:rec.targets,rates:rec.rates};}
 }
 out.touched=[...new Set([...out.updates.map(u=>u.i),...Object.keys(out.report).map(Number)])];
 if(!out.touched.length)out.errors.push('未找到北一二C九店資料。請上傳含「實際總獎金、推估原始總獎金、排名、領獎與否」的原始報表。');
 if(out.touched.length<9&&out.touched.length)out.warnings.push(`本檔只讀到${out.touched.length}店；其他店不冒用本檔日期，首頁會標示待更新。`);
 for(const i of out.touched){const rec=out.report[i];if(!rec||SUMMARY_KEYS.some(k=>rec[k]===null))out.warnings.push(`${D.stores[i].name}：總額／排名／領獎欄有缺項，缺欄將顯示「未提供」，不以9組估算補上。`);}
 out.errors=[...new Set(out.errors)];out.warnings=[...new Set(out.warnings)];return out;
}
return {parseCsv,readXlsx,combineSheets};};
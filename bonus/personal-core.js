/* N12C November personal bonus: parse the user's daily Excel and simulate tomorrow. */
(function(root){'use strict';
const INT=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000;
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\s\u00a0_]/g,'').replace(/[／&＆、]/g,'/');
const raw=v=>v&&typeof v==='object'&&v.formula?(v.cached??''):v;
const nrm=v=>norm(raw(v));
const empId=v=>/^(?:\d{7}|\d{3}[a-z]\d{3})$/i.test(String(raw(v)??'').trim());
const code=v=>/^dnb\d+$/i.test(String(raw(v)??'').trim());
function number(v,integer=false){v=raw(v);if(v==null||String(v).trim()==='')return null;const s=String(v).normalize('NFKC').replace(/[\s,$＄]/g,'');if(!/^-?\d+(?:\.\d+)?$/.test(s))return null;const n=Number(s);if(!Number.isFinite(n)||(integer&&!INT(n)))return null;return n;}
function cleanModel(v){return nrm(v).replace(/^(上線數|空機數)\d+/,'').replace(/samsunggalaxy|samsung|google|oppo|vivo|sharp|sony/g,'');}
function modelHit(v,config){
 const s=cleanModel(v); if(!s)return null;
 const extra=[
  ['pixel10a','pixel_pro_10a'],['pixel11pro/11proxl/11profold','pixel_pro_10a'],['pixel11pro/proxl/11profold','pixel_pro_10a'],['pixel11pro/proxl/profold','pixel_pro_10a'],
  ['reno16f','reno16f'],['v80lite','v80lite'],['v80l','v80lite'],['a6x/a7pro','a6x_a7pro'],['a6x6g/128g/a7pro','a6x_a7pro'],['a57','a57'],
  ['s26256g','s26_256'],['s26256gb','s26_256'],['pixel11','pixel11'],['zflip8/zfold8/zfold8ultra','fold'],['zfold8ultra/zfold8/zflip8','fold'],['zflip8/fold8/fold8ultra','fold'],
  ['pixel10','pixel10'],['s26ultra','s26ultra'],['findx10','findx10'],['y32','y32_note17'],['note17pro/note17','y32_note17'],['y32/note17pro/note17','y32_note17'],
  ['v80','v80'],['x500','x500'],['s26512g/s26+','s26_512_plus'],['s26512gb/s26+','s26_512_plus'],['s26/s26+','s26_512_plus'],
  ['r11','r11_1viii'],['1viii','r11_1viii'],['r11/1viii','r11_1viii'],['a27','a27'],['myfirst/tcl','kidswatch'],['myfirst兒錶/咖波tcl兒錶','kidswatch'],
  ['watch4/watch5','pixelwatch'],['pixelwatch4/watch5','pixelwatch'],['y21','y21'],['10viii','xperia10viii'],['xperia10viii','xperia10viii'],['a17','a17'],['streamer','streamer'],['googletvstreamer4k','streamer']
 ];
 const hit=extra.find(x=>x[0]===s); if(hit)return hit[1];
 for(const m of config.models||[]){const aliases=[m.id,m.name,...(m.aliases||[])].map(cleanModel);if(aliases.includes(s))return m.id;}
 return null;
}
function detectPeriod(sheets,filename=''){
 const set=new Set();const scan=t=>{for(const m of String(t).matchAll(/(?:2026[\/-]?(10|11)|2026年(10|11)月|115[\/-](10|11)|(?:^|\s)(10|11)月份)/g))set.add('2026-'+(m[1]||m[2]||m[3]||m[4]));};
 scan(filename);for(const sh of sheets)for(let r=0;r<Math.min(12,sh.rows.length);r++)scan((sh.rows[r]||[]).map(x=>String(raw(x)??'')).join(' '));
 return [...set];
}
function summaryColumns(row){
 // XLSX omits empty cells. Array.from fills sparse slots before string matching.
 const vals=Array.from(row||[],nrm);
 const actual=vals.findIndex(x=>x==='實際總獎金'||x==='實際獎金'||x.includes('實際總獎金'));
 const projected=vals.findIndex(x=>x.startsWith('推估原始總獎金')||x.includes('推估原始總獎金')||x==='推估總獎金'||x.includes('推估總獎金'));
 const rank=vals.findIndex(x=>x==='排名'||x==='名次');
 const eligible=vals.findIndex(x=>x==='yn'||x==='y/n'||x.startsWith('領獎與否')||x.includes('領獎與否'));
 return actual>=0&&projected>=0&&rank>=0?{actual,projected,rank,eligible}:null;
}
function leaderboardFromSheet(sheet){
 const rows=sheet.rows||[];let h=-1,cols=null;const rankTiers=[],thresholds={first:5000,second:9000};
 for(let r=0;r<Math.min(rows.length,100);r++){const row=rows[r]||[],joined=row.map(x=>String(raw(x)??'')).join(' '),found=summaryColumns(row);
  if(found&&h<0){h=r;cols=found;const tierRows=[rows[Math.max(0,r-1)]||[],row];for(const tr of tierRows){for(let q=0;q<Math.min(4,tr.length);q++){const v=String(raw(tr[q])??'').trim();if(v&&!rankTiers.includes(v))rankTiers.push(v);}}}
  const m1=joined.match(/第一檻[^\d]*([\d,]+)/),m2=joined.match(/第二檻[^\d]*([\d,]+)/);if(m1)thresholds.first=Number(m1[1].replace(/,/g,''));if(m2)thresholds.second=Number(m2[1].replace(/,/g,''));
 }
 if(h<0||!cols)return null;const list=[];
 for(let r=h+1;r<rows.length;r++){const row=rows[r]||[],ec=row.findIndex(empId);if(ec<0)continue;const id=String(raw(row[ec])??'').trim(),ab=number(row[cols.actual]),pb=number(row[cols.projected]),rk=number(row[cols.rank],true),yn=cols.eligible>=0?String(raw(row[cols.eligible])??'').trim().toUpperCase():'';
  const store=String(raw(row[Math.max(0,ec-2)])??'').trim(),title=String(raw(row[Math.max(0,ec-1)])??'').trim(),person=String(raw(row[ec+1])??'').trim();
  list.push({store,title,employeeId:id,name:person,actualBonus:ab,projectedBonus:pb,rank:rk,eligible:['Y','N'].includes(yn)?yn:null});
 }
 return {leaderboard:list,thresholds,rankTiers:rankTiers.slice(0,8)};
}
function parseRaw(sheet,config,storeDefs){
 const rows=sheet.rows||[],errors=[],warnings=[];let header=-1,descs=[],subEnd=-1,identityCols=null,summaryCols=null;
 for(let r=0;r<Math.min(rows.length,30);r++){const row=rows[r]||[],heads=[];row.forEach((v,c)=>{const s=String(raw(v)??'').normalize('NFKC').replace(/\s/g,'');if(/^(上線數|空機數)_?\d+_/i.test(s)){const id=modelHit(v,config);if(id)heads.push({c,id,kind:nrm(v).startsWith('上線數')?'online':'empty'});}});
  if(heads.length>=5){header=r;descs=[];for(let k=0;k<heads.length;k++){const hd=heads[k],end=heads[k+1]?.c??row.length;let a=-1,t=-1,rate=-1;for(let rr=r+1;rr<=Math.min(r+5,rows.length-1);rr++){const sub=rows[rr]||[];if(sub.some(v=>/^上線數|^空機數/i.test(String(raw(v)??'').trim())))break;for(let c=hd.c;c<end;c++){const s=nrm(sub[c]);if(s==='實際數'&&a<0)a=c;if((s==='店目標數'||s==='目標數')&&t<0)t=c;if((s==='店推估達成率'||s==='推估達成率')&&rate<0)rate=c;}if(a>=0){subEnd=Math.max(subEnd,rr);break;}}if(a>=0)descs.push({...hd,a,t,rate});}
   break;}
 }
 if(header<0)throw Error('找不到「手機競賽 個人上線數＆空機數」資料結構。');
 for(let r=subEnd+1;r<rows.length;r++){const row=rows[r]||[];const cc=row.findIndex(code),ec=row.findIndex(empId);if(cc>=0&&ec>=0){identityCols={code:cc,store:cc+1,title:ec-1,employee:ec,name:ec+1,tenure:ec+2};break;}}
 if(!identityCols)throw Error('找不到門市代碼／員編欄位。');
 for(let r=0;r<=Math.min(Math.max(subEnd,header+8),rows.length-1);r++){const found=summaryColumns(rows[r]||[]);if(found){summaryCols=found;break;}}
 const byId=new Map(),fallback=[];for(let r=subEnd+1;r<rows.length;r++){const row=rows[r]||[],id=String(raw(row[identityCols.employee])??'').trim();if(!empId(id))continue;const storeCode=String(raw(row[identityCols.code])??'').trim(),store=String(raw(row[identityCols.store])??'').trim(),title=String(raw(row[identityCols.title])??'').trim(),person=String(raw(row[identityCols.name])??'').trim();const online={},empty={};
  for(const d of descs){const v=number(row[d.a],true);if(v===null)continue;const box=d.kind==='online'?online:empty;box[d.id]=(box[d.id]||0)+v;}
  const e={storeCode,store,title,employeeId:id,name:person,online,empty};byId.set(id,e);
  if(summaryCols){const ab=number(row[summaryCols.actual]),pb=number(row[summaryCols.projected]),rk=number(row[summaryCols.rank],true),yn=summaryCols.eligible>=0?String(raw(row[summaryCols.eligible])??'').trim().toUpperCase():'';fallback.push({store,title,employeeId:id,name:person,actualBonus:ab,projectedBonus:pb,rank:rk,eligible:['Y','N'].includes(yn)?yn:null});}
 }
 const employees=[...byId.values()];if(!employees.length)throw Error('未辨識任何同仁資料。');
 const storeIndex=new Map((storeDefs||[]).map((s,i)=>[String(s.id).toUpperCase(),i])),storeStatus={};for(const e of employees){if(!storeStatus[e.storeCode])storeStatus[e.storeCode]={};const i=storeIndex.get(e.storeCode.toUpperCase());for(const m of config.models){if(!storeStatus[e.storeCode][m.id])storeStatus[e.storeCode][m.id]={actual:0,target:i===undefined?null:m.targets[i]};storeStatus[e.storeCode][m.id].actual+=(e.online[m.id]||0);}}
 for(const [sc,models] of Object.entries(storeStatus))for(const [id,v] of Object.entries(models)){if(!INT(v.target)||v.target<=0)warnings.push(sc+'／'+id+'：正式目標待確認。');}
 return {employees,storeStatus,fallback,warnings,errors};
}
function parseWorkbook(sheets,config,storeDefs,filename=''){
 const periods=detectPeriod(sheets,filename),errors=[],warnings=[];if(periods.length&&(!periods.includes('2026-11')||periods.length>1))errors.push('檔案辨識到'+periods.join('、')+'，不可發布到11月個人台獎。');
 let ranking=null;for(const sh of sheets){const r=leaderboardFromSheet(sh);if(r&&r.leaderboard.length&&r.leaderboard.some(x=>x.actualBonus!==null||x.projectedBonus!==null||x.rank!==null)){ranking=r;break;}}
 let rawSheet=sheets.find(s=>(s.rows||[]).some((row,i)=>i<15&&row.some(v=>String(raw(v)??'').includes('手機競賽 個人上線數'))));if(!rawSheet)rawSheet=sheets.find(s=>(s.rows||[]).slice(0,20).flat().filter(v=>String(raw(v)??'').startsWith('上線數_')).length>=5);
 if(!rawSheet)errors.push('找不到個人手機競賽原始頁籤。');
 let parsed=null;if(rawSheet)try{parsed=parseRaw(rawSheet,config,storeDefs);warnings.push(...parsed.warnings);}catch(e){errors.push(e.message);}
 const leaderboard=ranking?.leaderboard?.length?ranking.leaderboard:(parsed?.fallback||[]).sort((a,b)=>(b.projectedBonus||0)-(a.projectedBonus||0));
 const thresholds=ranking?.thresholds||config.thresholds||{first:5000,second:9000},rankTiers=ranking?.rankTiers||[];
 if(!leaderboard.length)errors.push('找不到「獎金表」排行榜，也無法從原始頁取得獎金欄。');else if(!leaderboard.some(x=>x.actualBonus!==null||x.projectedBonus!==null||x.rank!==null))errors.push('已辨識同仁名單，但「實際總獎金／推估原始總獎金／排名」皆未讀到，為避免空白覆寫已停止發布。');
 return {periods,leaderboard,employees:parsed?.employees||[],storeStatus:parsed?.storeStatus||{},thresholds,rankTiers,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
function payoutRate(model,actual,target){if(!INT(actual)||!INT(target)||target<=0)return 0;const r=actual/target;if(r>=2)return model.rate200;if(r>=0.5)return model.rate50;return 0;}
function simulate(personal,config,employeeId,inputs){
 const e=(personal.employees||[]).find(x=>x.employeeId===employeeId);if(!e)return null;const base=(personal.leaderboard||[]).find(x=>x.employeeId===employeeId)||{};const models=[],store=personal.storeStatus?.[e.storeCode]||{};let delta=0;
 for(const m of config.models){const st=store[m.id]||{actual:0,target:null},online=Math.max(0,Number(inputs?.[m.id]?.online||0)|0),empty=Math.max(0,Number(inputs?.[m.id]?.empty||0)|0),oldOnline=e.online?.[m.id]||0,oldEmpty=e.empty?.[m.id]||0,target=st.target,actual=st.actual,currentRate=payoutRate(m,actual,target),tomorrowActual=INT(actual)?actual+online:null,tomorrowRate=payoutRate(m,tomorrowActual,target),currentRecognized=oldOnline*currentRate+oldEmpty*m.emptyRate,tomorrowRecognized=(oldOnline+online)*tomorrowRate+(oldEmpty+empty)*m.emptyRate,d=tomorrowRecognized-currentRecognized;delta+=d;models.push({id:m.id,name:m.name,target,storeActual:actual,storeRate:INT(target)&&target?actual/target:null,tomorrowActual,tomorrowRate:INT(target)&&target?tomorrowActual/target:null,oldOnline,oldEmpty,todayOnline:online,todayEmpty:empty,currentRate,tomorrowUnitRate:tomorrowRate,emptyRate:m.emptyRate,delta:d,need50:INT(target)&&target?Math.max(0,Math.ceil(target*.5)-actual):null,need200:INT(target)&&target?Math.max(0,Math.ceil(target*2)-actual):null});}
 const projected=typeof base.projectedBonus==='number'?base.projectedBonus:null;return {employee:e,base,delta,estimated:projected===null?null:projected+delta,models};
}
function opportunities(personal,config,employeeId){
 const e=(personal.employees||[]).find(x=>x.employeeId===employeeId);if(!e)return [];const store=personal.storeStatus?.[e.storeCode]||{};return config.models.map(m=>{const st=store[m.id]||{},actual=st.actual,target=st.target;if(!INT(actual)||!INT(target)||!target)return null;const r=actual/target,old=e.online?.[m.id]||0,need50=Math.max(0,Math.ceil(target*.5)-actual),need200=Math.max(0,Math.ceil(target*2)-actual);let status,action,value,score;if(r<.5){status='待跨50%';action='店再'+need50+'台解鎖';value=(old+Math.max(1,need50))*m.rate50;score=value/Math.max(1,need50);}else if(r<2){status='已解鎖';action='今日每台 $'+m.rate50.toLocaleString();value=m.rate50;score=m.rate50+(need200<=2?old*(m.rate200-m.rate50):0);}else{status='200%加碼';action='今日每台 $'+m.rate200.toLocaleString();value=m.rate200;score=m.rate200;}return {id:m.id,name:m.name,status,action,score,rate:r,actual,target,need50,need200,currentUnits:old,rate50:m.rate50,rate200:m.rate200};}).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,8);
}
root.NPersonal={parseWorkbook,simulate,opportunities,payoutRate};
})(window);

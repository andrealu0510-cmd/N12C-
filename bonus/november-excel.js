/* Excel-only target updates share the same preview/publish flow, never sales rows. */
(function(root){'use strict';
const C=root.NBonus,originalAnalyse=C.analyse;
function raw(v){if(v&&typeof v==='object'&&v.formula){if(v.cached===undefined||v.cached==='')throw Error('公式未存計算結果，請先在Excel重算存檔。');return v.cached;}return v;}
const norm=v=>String(raw(v)??'').normalize('NFKC').replace(/\s/g,'').toLowerCase();
const goalName=s=>/目標|targets?/i.test(s||'');
C.analyse=function(sheets,defs,filename=''){
 const p=originalAnalyse(sheets,defs,filename);
 if(goalName(filename)&&!sheets.some(s=>s.rows.some(row=>row.some(v=>/實際數|有效上線|實績/.test(String(raw(v)??''))))))p.errors.push('這看起來是目標表；請將「匯入用途」改成「只更新月目標」，避免把目標當實績。');
 p.intent='actual';return p;
};
C.analyseTargets=function(sheets,defs,filename=''){
 const transformed=[],errors=[],warnings=[];
 for(const s of sheets){try{
  if(/獎金表|獎金級距|方案|建議台數/.test(s.name||'')){warnings.push('略過非目標頁：'+s.name);continue;}
  if(s.rows.some(row=>row.some(v=>/^上線數_?\d+_/.test(String(raw(v)??'').replace(/\s/g,''))))){transformed.push({...s,name:'目標匯入 '+s.name});continue;}
  const rows=[],preamble=[];let header=null;
  for(let r=0;r<s.rows.length;r++){
   const row=s.rows[r]||[],cells=row.map(norm);
   const si=cells.findIndex(v=>['門市','門市名稱','營業點名稱','店點'].includes(v)),ci=cells.findIndex(v=>['代碼','門市代碼','營業點代碼'].includes(v));
   if(si>=0||ci>=0){const mi=cells.findIndex(v=>['競賽組','競賽機型','機型','競賽機款'].includes(v)),ti=cells.findIndex(v=>['目標','目標數','月目標'].includes(v));const wide=row.map((v,c)=>({c,key:C.modelKey(v,defs),name:raw(v)})).filter(v=>v.key.j>=0||v.key.j===-2);
    if(mi>=0&&ti>=0)header={si,ci,mi,ti};else if(wide.filter(x=>x.key.j>=0).length>=2)header={si,ci,wide};else header=null;
    continue;
   }
   if(!header){if(r<12)preamble.push(row);continue;}
   const code=header.ci>=0?raw(row[header.ci]):'',store=header.si>=0?raw(row[header.si]):'';
   if(!code&&!store)continue;
   const append=(name,target)=>{if(C.modelKey(name,defs).j===-2){warnings.push('S26／S26+目標未冒認為256G正式目標，保留原暫估。');return;}rows.push([code,store,name,raw(target),raw(target)]);};
   if(header.wide)header.wide.forEach(x=>append(x.name,row[x.c]));else append(raw(row[header.mi]),row[header.ti]);
  }
  if(rows.length)transformed.push({name:'目標匯入',rows:[...preamble,['門市代碼','門市','競賽組','實際數','目標數'],...rows]});
 }catch(e){errors.push(s.name+'：'+e.message);}}
 const p=originalAnalyse(transformed,defs,filename);
 p.updates=p.updates.filter(u=>u.target!==null).map(u=>({...u,value:null,rate:null}));p.touched=[...new Set(p.updates.map(u=>u.i))];p.reports={};p.region=null;p.intent='targets-only';p.errors=[...new Set([...p.errors,...errors])];p.warnings=[...new Set([...p.warnings,...warnings,'只改目標及來源標示；實績、資料截至日、原表金額、排名與領獎不改動。'])];
 if(!p.updates.length)p.errors.push('未讀到可更新的目標數；請提供店名／機型／目標數，或機款橫式目標表。');return p;
};
C.applyTargets=function(previous,p,date,file){if(p.intent!=='targets-only'||p.errors.length||!C.isDate(date))throw Error('目標月份或內容不正確。');const s=JSON.parse(JSON.stringify(previous));for(const u of p.updates){s.targets[u.i][u.j]=u.target;s.origins[u.i][u.j]='report';}s._targetOnly=true;s._targetDate=date;s.sourceTargets={file};return s;};
})(typeof window==='undefined'?globalThis:window);

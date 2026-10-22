import {parseSheet} from './parser.js';
import {DEFAULT_STORES,finite,validDate,period,escapeHtml as esc,metricValue,numeric,percent,statusClass} from './core.js';
export const VERSION='20261022.5';
const txt=v=>String(v?.v??v??'').normalize('NFKC').replace(/\s+/g,'').trim();
const value=(sheet,r,c,X)=>sheet[X.utils.encode_cell({r,c})];
const sameName=(a,b)=>txt(a).replace(/[()（）_]/g,'').toUpperCase()===txt(b).replace(/[()（）_]/g,'').toUpperCase();

/** Read a store report without manufacturing per-person data or summing percentages. */
export function parseStoreWorkbook(wb,X){
 const candidates=[];
 for(const sheetName of wb.SheetNames||[]){
  const ws=wb.Sheets[sheetName];if(!ws?.['!ref'])continue;
  const cells=Object.keys(ws).filter(k=>/^[A-Z]+\d+$/.test(k)).map(k=>({...X.utils.decode_cell(k),cell:ws[k]}));
  const rankHeads=cells.filter(x=>/^排名$/.test(txt(x.cell))&&/總進度/.test(txt(value(ws,x.r,x.c+1,X))));
  for(const head of rankHeads){
   const rankCol=head.c;if(rankCol<2)continue;
   let leaf=-1;
   for(let r=head.r+1;r<=head.r+5;r++)if(/實際|實績/.test(txt(value(ws,r,rankCol+2,X)))&&/目標/.test(txt(value(ws,r,rankCol+3,X)))&&/權重/.test(txt(value(ws,r,rankCol+4,X)))&&/進度/.test(txt(value(ws,r,rankCol+5,X)))){leaf=r;break;}
   if(leaf<0)continue;
   const storeRows=cells.filter(x=>x.c===rankCol-2&&x.r>leaf&&/^DNB\d{5}$/.test(txt(x.cell))&&DEFAULT_STORES.includes(txt(value(ws,x.r,rankCol-1,X))));
   if(!storeRows.length)continue;
   const blocks=cells.filter(x=>x.r===leaf&&/實際|實績/.test(txt(x.cell))&&/目標/.test(txt(value(ws,leaf,x.c+1,X)))&&/權重/.test(txt(value(ws,leaf,x.c+2,X)))&&/進度/.test(txt(value(ws,leaf,x.c+3,X))));
   const end=Math.max(...blocks.map(x=>x.c))+4;
   const extraPercent=storeRows.some(row=>cells.some(x=>x.r===row.r&&x.c>=end&&x.c<end+12&&(/%/.test(txt(x.cell))||/%/.test(String(x.cell.z||'')))));
   if(extraPercent)throw new Error('店點報表表頭與資料欄數不一致，可能有遺漏的KPI表頭；請上傳完整01-01-03原始Excel，不會猜測或位移對應欄位。');
   const first=Math.min(...storeRows.map(x=>x.r)),last=Math.max(...storeRows.map(x=>x.r));
   const allowedRows=new Set(storeRows.map(x=>x.r));const clean={};
   for(const cell of cells)if(cell.r<=leaf||allowedRows.has(cell.r))clean[X.utils.encode_cell(cell)]={...cell.cell};
   clean['!ref']=X.utils.encode_range({r:0,c:0},{r:last,c:Math.max(...cells.map(x=>x.c))});
   clean['!merges']=(ws['!merges']||[]).filter(m=>m.e.r<=leaf);
   const parsed=parseSheet({SheetNames:[sheetName],Sheets:{[sheetName]:clean}},sheetName,{
    headerStartRow:head.r,headerEndRow:leaf,dataStartRow:first,
    mapping:{employeeId:rankCol-2,name:rankCol-1,store:rankCol-1,job:null,rank:rankCol,overallProgress:rankCol+1}
   },X);
   if(!parsed.ok)throw new Error(parsed.errors.map(e=>e.message).join('；'));
   const bad=parsed.warnings.filter(w=>/AMBIGUOUS_PERCENT|AMBIGUOUS_COLUMN|FORMULA_WITHOUT_VALUE|INVALID_NUMBER|CELL_ERROR/.test(w.code));
   if(bad.length)throw new Error('店點報表有待確認欄位：'+bad.slice(0,3).map(x=>x.message).join('；'));
   if(!validDate(parsed.detectedDate))throw new Error('01-01-03沒有可確認的資料截止日，請保留報表日期與完整表頭。');
   const seen=new Set();for(const r of parsed.rows){if(seen.has(r.store))throw new Error('同一店點重複，請上傳單一日期的店點報表。');seen.add(r.store);}
   const p=period(parsed.detectedDate);
   const check=(samples,basis)=>samples.length>=3&&new Set(samples.map(s=>s.store)).size>=2&&samples.every(s=>Math.abs(s.actual/s.target*100*(basis==='month'?p.days/p.day:1)-s.progress)<=Math.max(.2,s.progress*.0005));
   const samples=parsed.rows.flatMap(r=>['a999','r999','r1399'].map(k=>({...r.metrics[k],store:r.store,key:k}))).filter(m=>finite(m.actual)&&m.target>0&&finite(m.progress)&&m.progress>0&&m.progress<250);
   const monthly=check(samples,'month'),todate=check(samples,'toDate');const basis=monthly!==todate?(monthly?'month':'toDate'):'unknown';
   const metricDefinitions=parsed.metricDefinitions.map(d=>{
    const ms=parsed.rows.map(r=>({...r.metrics[d.key],store:r.store})).filter(m=>finite(m.actual)&&m.target>0&&finite(m.progress)&&m.progress>0&&m.progress<250);
    const special=/自退|解約|降轉|升轉|加分項/.test(d.sourceLabel);
    const linear=!special&&basis!=='unknown'&&check(ms,basis);
    return{key:d.key,label:d.label,sourceLabel:d.sourceLabel,unit:d.unit==='未確認'?'依原表':d.unit,targetBasis:linear?basis:'unknown',calculation:linear?'linear':'source-only',reminderEligible:d.reminderEligible!==false};
   });
   const rows=parsed.rows.map(r=>({store:r.store,storeCode:r.employeeId,rank:r.rank,overallProgress:r.overallProgress,metrics:Object.fromEntries(metricDefinitions.map(d=>{const m=r.metrics[d.key]||{};return[d.key,{actual:finite(m.actual)?m.actual:null,target:finite(m.target)?m.target:null,progress:finite(m.progress)?m.progress:null,achievement:finite(m.achievement)?m.achievement:null,gap:finite(m.gap)?m.gap:null,targetBasis:d.targetBasis}];}))}));
   candidates.push({cutoffDate:parsed.detectedDate,sheetName,metricDefinitions,rows});break;
  }
 }
 if(candidates.length!==1)throw new Error(candidates.length?'找到多個店點報表頁籤，請保留本次要匯入的一個頁籤。':'未辨識到01-01-03店點報表；請勿在此上傳01-01-05個人報表，並保留店點代碼、排名、總進度與完整表頭。');
 return candidates[0];
}
export function matchStoreMetric(def,storeDefs=[]){
 const name=def.sourceLabel||def.label;
 const exact=storeDefs.filter(d=>sameName(d.sourceLabel||d.label,name));
 if(exact.length===1)return exact[0];
 const keyed=storeDefs.filter(d=>d.key===def.key&&sameName(d.label,def.label));
 return keyed.length===1?keyed[0]:null;
}
export function groupedPeople(rows,{store='',query='',threshold='all',sort='progress'}={}){
 const q=query.trim().toLowerCase();const groups=new Map();
 for(const e of rows||[]){if(store&&e.store!==store)continue;if(q&&![e.store,e.name,e.employeeId].join(' ').toLowerCase().includes(q))continue;if(threshold!=='all'&&(!finite(e.overallProgress)||e.overallProgress>=Number(threshold)))continue;if(!groups.has(e.store))groups.set(e.store,[]);groups.get(e.store).push(e);}
 return [...groups].sort((a,b)=>DEFAULT_STORES.indexOf(a[0])-DEFAULT_STORES.indexOf(b[0])).map(([store,people])=>({store,people:people.sort((a,b)=>{const k=sort==='rank'?'rank':'overallProgress';return finite(a[k])&&finite(b[k])?a[k]-b[k]:finite(a[k])?-1:finite(b[k])?1:0;})}));
}
export function groupedTable(groups,defs,personal,storeSnapshot){
 if(!groups.length)return '<p class="muted">此範圍沒有符合條件的同仁。</p>';
 const cells=(row,sourceDefs,date,isStore=false)=>defs.map(d=>{const actualDef=isStore?matchStoreMetric(d,sourceDefs):d;if(!actualDef||!row)return '<td colspan="4" class="muted">'+(!row?'待上傳01-01-03':'無對應資料')+'</td>';const m=metricValue(row,actualDef,date);return '<td>'+numeric(m.actual,2)+'</td><td>'+numeric(m.target,2)+'</td><td>'+numeric(m.gap,2)+'</td><td class="'+statusClass(m.progress)+'">'+percent(m.progress)+'</td>';}).join('');
 return '<table class="group-kpi"><thead><tr><th rowspan="2">店點／同仁</th><th rowspan="2">原表排名</th><th rowspan="2">總進度</th>'+defs.map(d=>'<th colspan="4">'+esc(d.label)+'（'+esc(d.unit||'依原表')+'）</th>').join('')+'</tr><tr>'+defs.map(()=>'<th>實績</th><th>目標</th><th>差額</th><th>進度</th>').join('')+'</tr></thead><tbody>'+groups.map(g=>{const s=storeSnapshot?.rows?.find(x=>x.store===g.store);return '<tr class="store-total"><th scope="row">'+esc(g.store)+'<small>店點整體 · '+(s?esc(storeSnapshot.cutoffDate):'待上傳01-01-03')+'</small></th><td>'+numeric(s?.rank,0)+'</td><td>'+percent(s?.overallProgress)+'</td>'+cells(s,storeSnapshot?.metricDefinitions||[],storeSnapshot?.cutoffDate,true)+'</tr>'+g.people.map(e=>'<tr class="employee-row"><th scope="row">　'+esc(e.name)+'<small>'+esc(e.employeeId)+' · '+esc(e.job||'')+'</small></th><td>'+numeric(e.rank,0)+'</td><td class="'+statusClass(e.overallProgress)+'">'+percent(e.overallProgress)+'</td>'+cells(e,personal.metricDefinitions,personal.cutoffDate)+'</tr>').join('');}).join('')+'</tbody></table>';
}

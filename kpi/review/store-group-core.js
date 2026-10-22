import {parseSheet} from './parser.js';
import {DEFAULT_STORES,finite,validDate,period,escapeHtml as esc,metricValue,numeric,percent,statusClass} from './core.js';
export const VERSION='20261022.6';
const txt=v=>String(v?.v??v??'').normalize('NFKC').replace(/\s+/g,'').trim();
const value=(sheet,r,c,X)=>sheet[X.utils.encode_cell({r,c})];
const sameName=(a,b)=>txt(a).replace(/[()（）_]/g,'').toUpperCase()===txt(b).replace(/[()（）_]/g,'').toUpperCase();

/** Read a store report without manufacturing per-person data or summing percentages. */
export function parseStoreWorkbook(wb,X){
 const candidates=[];let personalRowsFound=false;
 for(const sheetName of wb.SheetNames||[]){
  const ws=wb.Sheets[sheetName];if(!ws?.['!ref'])continue;
  const cells=Object.keys(ws).filter(k=>/^[A-Z]+\d+$/.test(k)).map(k=>({...X.utils.decode_cell(k),cell:ws[k]}));
  const rankHeads=cells.filter(x=>/^排名$/.test(txt(x.cell))&&/總進度/.test(txt(value(ws,x.r,x.c+1,X)))).sort((a,b)=>a.r-b.r);
  const rowCells=new Map();for(const cell of cells){if(!rowCells.has(cell.r))rowCells.set(cell.r,[]);rowCells.get(cell.r).push(cell);}
  for(const head of rankHeads){
   const rankCol=head.c;if(rankCol<2)continue;
   let leaf=-1;
   for(let r=head.r+1;r<=head.r+5;r++)if(/實際|實績/.test(txt(value(ws,r,rankCol+2,X)))&&/目標/.test(txt(value(ws,r,rankCol+3,X)))&&/權重/.test(txt(value(ws,r,rankCol+4,X)))&&/進度/.test(txt(value(ws,r,rankCol+5,X)))){leaf=r;break;}
   if(leaf<0)continue;
   // A report can contain a regional summary above a second, different KPI header.
   // Never attach store rows to an earlier section's header.
   const sectionEnd=rankHeads.find(x=>x.r>head.r)?.r??Infinity;
   const storeRows=[];
   for(const [r,row] of rowCells){
    if(r<=leaf||r>=sectionEnd)continue;
    const prefix=row.filter(x=>x.c<rankCol);
    const names=prefix.filter(x=>DEFAULT_STORES.includes(txt(x.cell)));
    const codes=prefix.filter(x=>/^DNB\d{5}$/i.test(txt(x.cell)));
    if(names.length!==1||codes.length!==1)continue;
    // 01-01-05 also contains store codes: a name/code pair alone is not proof
    // of a store aggregate. Reject employee IDs and job fields in the prefix.
    const personal=prefix.some(x=>/^55[A-Z0-9]{5}$/i.test(txt(x.cell))||/^(?:代理店長|副店長|店長|業務代表|銷售人員|業代)/.test(txt(x.cell)));
    if(personal){personalRowsFound=true;continue;}
    storeRows.push({...codes[0],nameCol:names[0].c});
   }
   if(!storeRows.length)continue;
   const codeCol=storeRows[0].c,nameCol=storeRows[0].nameCol;
   if(storeRows.some(x=>x.c!==codeCol||x.nameCol!==nameCol))throw new Error('店點代碼或店名分布在不同欄位，請確認單一表格的欄位排列；尚未存檔。');
   // Map explicit child headers, including horizontally merged target/weight
   // cells. Copy their cached values into a temporary compact sheet; do not
   // edit the user's workbook or assume every KPI occupies four physical cells.
   const merged=(r,c)=>{const m=(ws['!merges']||[]).find(m=>m.s.r<=r&&m.e.r>=r&&m.s.c<=c&&m.e.c>=c);return m?value(ws,m.s.r,m.s.c,X):value(ws,r,c,X);};
   const actualHeads=(rowCells.get(leaf)||[]).filter(x=>x.c>rankCol&&/^(?:實際數|實際|實績)$/.test(txt(x.cell))).sort((a,b)=>a.c-b.c);
   const blocks=actualHeads.map((x,i)=>{
    const caption=txt(merged(head.r,x.c));
    if(!caption)throw new Error('工作表「'+sheetName+'」'+X.utils.encode_cell({r:head.r,c:x.c})+'缺少KPI名稱，尚未存檔；不會猜測欄位。');
    const merge=(ws['!merges']||[]).find(m=>m.s.r<=head.r&&m.e.r>=head.r&&m.s.c<=x.c&&m.e.c>=x.c);
    const limit=Math.min(actualHeads[i+1]?.c??Infinity,merge&&merge.e.c>x.c?merge.e.c+1:Infinity);
    const children=(rowCells.get(leaf)||[]).filter(y=>y.c>=x.c&&y.c<limit);
    const getCol=re=>{const matches=children.filter(y=>re.test(txt(y.cell)));if(matches.length!==1)throw new Error('工作表「'+sheetName+'」的「'+caption+'」子欄位不完整或重複，請保留實際數、目標數、權重及進度表頭。');return matches[0].c;};
    const fields=[x.c,getCol(/^目標(?:數)?$/),getCol(/^權重$/),getCol(/^(?:進度(?:達成率)?|達成率)$/)];
    if(fields.some((c,j)=>j>0&&c<=fields[j-1]))throw new Error('「'+caption+'」的子欄位順序不一致，尚未存檔。');
    return{caption,fields,end:merge&&merge.e.c>x.c?merge.e.c+1:fields[3]+1};
   });
   if(!blocks.length)continue;
   const end=Math.max(...blocks.map(b=>b.end));
   const extraPercent=storeRows.some(row=>(rowCells.get(row.r)||[]).some(x=>x.c>=end&&x.c<end+12&&(/%/.test(txt(x.cell))||/%/.test(String(x.cell.z||'')))));
   if(extraPercent)throw new Error('店點報表表頭與資料欄數不一致，可能有遺漏的KPI表頭；請上傳完整01-01-03原始Excel，不會猜測或位移對應欄位。');
   const clean={};
   const put=(r,c,cell)=>{if(cell)clean[X.utils.encode_cell({r,c})]={...cell};};
   const label=v=>({t:'s',v});
   // Keep original date/period metadata, not the preceding regional summary.
   for(const cell of cells)if(cell.r<rankHeads[0].r)put(cell.r,cell.c,cell.cell);
   ['員編','店點','排名','總進度達成率'].forEach((v,c)=>put(head.r,c,label(v)));
   const merges=[];
   blocks.forEach((b,i)=>{const c=4+i*4;put(head.r,c,label(b.caption));merges.push({s:{r:head.r,c},e:{r:head.r,c:c+3}});['實際數','目標數','權重','進度達成率'].forEach((v,j)=>put(leaf,c+j,label(v)));});
   storeRows.sort((a,b)=>a.r-b.r).forEach((row,i)=>{
    const r=leaf+1+i;put(r,0,value(ws,row.r,codeCol,X));put(r,1,value(ws,row.r,nameCol,X));put(r,2,value(ws,row.r,rankCol,X));put(r,3,value(ws,row.r,rankCol+1,X));
    blocks.forEach((b,j)=>b.fields.forEach((c,k)=>put(r,4+j*4+k,merged(row.r,c))));
   });
   clean['!ref']=X.utils.encode_range({r:0,c:0},{r:leaf+storeRows.length,c:Math.max(3+blocks.length*4,...cells.filter(x=>x.r<rankHeads[0].r).map(x=>x.c))});clean['!merges']=merges;
   const normalized={SheetNames:[sheetName],Sheets:{[sheetName]:clean}};
   const options={headerStartRow:head.r,headerEndRow:leaf,dataStartRow:leaf+1,
    mapping:{employeeId:0,name:1,store:1,job:null,rank:2,overallProgress:3}};
   let parsed=parseSheet(normalized,sheetName,options,X);
   // RT ratio rows expose numerator/denominator counts in the first two
   // columns, not two percentages. Preserve the source progress percentage.
   const definitions=parsed.metricDefinitions.map(d=>/^RT[升降]轉率/.test(txt(d.sourceLabel))?{...d,unit:'件',progressKind:/件數|轉數/.test(d.sourceLabel)?'progress':'ratio',reminderEligible:false}:d);
   const extra={};
   blocks.forEach((b,i)=>{const c=4+i*4;if(Object.values(parsed.mapping.metrics).some(m=>m.actual?.column===c))return;
    let h=2166136261;for(const ch of b.caption)h=Math.imul(h^ch.charCodeAt(0),16777619);
    const key='store_'+(h>>>0).toString(36);const unit=/金額|營收/.test(b.caption)?'元':/點數/.test(b.caption)?'點':/數/.test(b.caption)?'件':'依原表';
    extra[key]={label:b.caption,sourceLabel:b.caption,unit,actual:c,target:c+1,progress:c+3,achievement:null,gap:null};
   });
   if(Object.keys(extra).length||definitions.some((d,i)=>d!==parsed.metricDefinitions[i]))parsed=parseSheet(normalized,sheetName,{...options,mapping:{...options.mapping,metrics:extra},metricDefinitions:definitions},X);
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
    return{key:d.key,label:d.label,sourceLabel:d.sourceLabel,unit:d.unit==='未確認'?'依原表':d.unit,targetBasis:linear?basis:'unknown',calculation:linear?'linear':'source-only',progressKind:d.progressKind||'progress',reminderEligible:d.reminderEligible!==false};
   });
   const rows=parsed.rows.map(r=>({store:r.store,storeCode:r.employeeId,rank:r.rank,overallProgress:r.overallProgress,metrics:Object.fromEntries(metricDefinitions.map(d=>{const m=r.metrics[d.key]||{};return[d.key,{actual:finite(m.actual)?m.actual:null,target:finite(m.target)?m.target:null,progress:finite(m.progress)?m.progress:null,achievement:finite(m.achievement)?m.achievement:null,gap:finite(m.gap)?m.gap:null,targetBasis:d.targetBasis}];}))}));
   candidates.push({cutoffDate:parsed.detectedDate,sheetName,metricDefinitions,rows});break;
  }
 }
 if(candidates.length!==1)throw new Error(candidates.length?'找到多個店點報表頁籤，請保留本次要匯入的一個頁籤。':personalRowsFound?'偵測到員編或職稱欄，這是個人報表。請使用01-01-05上傳入口；店點上傳請選01-01-03。':'尚未辨識店點表格（工作表：'+(wb.SheetNames||[]).join('、')+'）。請保留店點代碼、店名、排名、總進度及KPI表頭；空白間隔欄與上方區域彙總可保留。');
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

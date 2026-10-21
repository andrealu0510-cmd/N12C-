export const DEFAULT_KEYS=['a999','r999','r1399','broadband'];
export const DEFAULT_STORES=['台北公館','台北忠孝東','台北南京東','台北後山埤','士林夜市','天母德行東','台北新站前','台北天母','台北東區'];
export const RULES={overall_and_metric:'總進度 < 100%，且所選任一 KPI 進度 < 80%',metric_and_achievement:'所選任一 KPI 進度 < 100%，且同項月達成率 < 80%'};
export function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function taipeiDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;}
export function period(date){if(!validDate(date))return null;const [year,month,day]=date.split('-').map(Number);const days=new Date(Date.UTC(year,month,0)).getUTCDate();return{year,month,day,days,fraction:day/days};}
export function metricValue(employee,definition,date){
 const raw=employee.metrics?.[definition.key]||{};const p=period(date);
 const actual=finite(raw.actual)?raw.actual:null;const target=finite(raw.target)?raw.target:null;
 const unit=definition.unit||raw.unit||'未確認';const basis=raw.targetBasis||definition.targetBasis||'unknown';
 // Inverse, scored and source-specific KPIs cannot use the ordinary sales formula.
 // Keep their supplied percentages without inventing a due amount or deficit.
 if(raw.calculation==='source-only'||definition.calculation==='source-only'){
  const progress=finite(raw.progress)?raw.progress:null;const achievement=finite(raw.achievement)?raw.achievement:null;
  return{...raw,actual,target,unit,targetBasis:basis,calculation:'source-only',reminderEligible:definition.reminderEligible!==false,active:progress!==null||achievement!==null,achievement,progress,expected:null,gap:null,progressSource:progress!==null?'原報表':'原表未提供'};
 }
 const ratio=/[%％]|搭售率|占比|比例/.test(unit+' '+definition.label)||definition.kind==='ratio';
 const monthly=['monthly','month'].includes(basis);const toDate=['toDate','todate','to-date'].includes(basis);
 const active=target!==null?target>0:(finite(raw.progress)||finite(raw.achievement));
 const achievement=active?(finite(raw.achievement)?raw.achievement:actual!==null&&target>0&&(monthly||ratio)?actual/target*100:null):null;
 const expected=target!==null?(ratio?target:toDate?target:monthly&&p?target*p.fraction:null):null;
 const progress=active?(finite(raw.progress)?raw.progress:actual!==null&&expected>0?actual/expected*100:null):null;
 const gap=active?(expected!==null&&actual!==null?expected-actual:null):null;
 return{...raw,actual,target,unit,targetBasis:basis,reminderEligible:definition.reminderEligible!==false,active,achievement,progress,expected,gap,progressSource:finite(raw.progress)?'原報表':'依已確認目標基準換算'};
}
export function needsReport(employee,snapshot,keys,rule='overall_and_metric'){const values=(snapshot.metricDefinitions||[]).filter(d=>keys.includes(d.key)).map(d=>metricValue(employee,d,snapshot.cutoffDate)).filter(v=>v.active&&v.reminderEligible);if(rule==='metric_and_achievement')return values.some(v=>finite(v.progress)&&v.progress<100&&finite(v.achievement)&&v.achievement<80);return finite(employee.overallProgress)&&employee.overallProgress<100&&values.some(v=>finite(v.progress)&&v.progress<80);}
export function numeric(v,digits=1){if(!finite(v))return '—';return new Intl.NumberFormat('zh-TW',{maximumFractionDigits:digits}).format(v);}
export const percent=v=>finite(v)?numeric(v,1)+'%':'—';
export function statusClass(v){return !finite(v)?'muted':v<80?'danger':v<100?'warning':'good';}
export function sortPeople(rows,mode,metricKey,snapshot){const source=[...rows];const compare=(a,b,key,dir=1)=>{const av=a[key],bv=b[key];if(!finite(av))return finite(bv)?1:0;if(!finite(bv))return-1;return(av-bv)*dir;};return source.sort((a,b)=>{let n=0;if(mode==='rank-asc')n=compare(a,b,'rank');else if(mode==='rank-desc')n=compare(a,b,'rank',-1);else if(mode==='progress-asc')n=compare(a,b,'overallProgress');else if(mode==='metric-asc'){const def=snapshot.metricDefinitions.find(x=>x.key===metricKey);n=def?compare({v:metricValue(a,def,snapshot.cutoffDate).progress},{v:metricValue(b,def,snapshot.cutoffDate).progress},'v'):0;}return n||a.store.localeCompare(b.store,'zh-Hant')||a.employeeId.localeCompare(b.employeeId);});}
export function validateSnapshot(s){
 const errors=[];const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!object(s))return['資料快照格式不正確。'];
 if(!validDate(s.cutoffDate))errors.push('請確認有效的資料截止日。');
 if(s.cutoffDate>taipeiDate())errors.push('資料截止日不能晚於今天。');
 const rows=Array.isArray(s.rows)?s.rows:[],definitions=Array.isArray(s.metricDefinitions)?s.metricDefinitions:[];
 if(!rows.length||rows.length>6000)errors.push('上傳資料必須包含 1 至 6,000 位同仁。');
 if(!definitions.length||definitions.length>100)errors.push('請辨識 1 至 100 個 KPI 項目。');
 const metricKeys=new Set();
 for(const d of definitions){
  if(!object(d)||typeof d.key!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(d.key)||typeof d.label!=='string'||!d.label.trim()||d.label.length>200){errors.push('KPI 項目名稱或代碼格式不正確。');continue;}
  if(metricKeys.has(d.key))errors.push('KPI 項目代碼重複。');metricKeys.add(d.key);
  if(typeof d.unit!=='string'||!d.unit.trim()||d.unit.length>20||d.unit==='未確認')errors.push('請確認每個 KPI 的單位。');
  if(!['month','monthly','toDate','todate','to-date'].includes(d.targetBasis))errors.push('請確認各 KPI 的目標基準。');
 }
 const ids=new Set();
 for(const e of rows){
  if(!object(e)){errors.push('人員資料格式不正確。');continue;}
  if(typeof e.employeeId!=='string'||!/^[A-Za-z0-9-]{3,20}$/.test(e.employeeId))errors.push('有員編格式不正確。');
  if(ids.has(e.employeeId))errors.push('員編重複：'+e.employeeId);ids.add(e.employeeId);
  if(typeof e.store!=='string'||!e.store.trim()||e.store.length>100||typeof e.name!=='string'||!e.name.trim()||e.name.length>100)errors.push('員工店點或姓名缺漏／過長。');
  if(e.rank!=null&&(!Number.isSafeInteger(e.rank)||e.rank<1))errors.push('排名必須是正整數。');
  for(const key of ['overallProgress','overallAchievement'])if(e[key]!=null&&(!finite(e[key])||e[key]<0))errors.push('總進度／總達成百分比不正確。');
  if(!object(e.metrics)){errors.push('人員 KPI 資料格式不正確。');continue;}
  for(const d of definitions){if(!object(d))continue;const m=e.metrics[d.key];if(m==null)continue;if(!object(m)){errors.push('KPI 欄位格式不正確。');continue;}if(m.targetBasis!=null&&!['month','monthly','toDate','todate','to-date'].includes(m.targetBasis))errors.push('請確認各 KPI 的目標基準。');for(const key of ['actual','target','progress','achievement'])if(m[key]!=null&&(!finite(m[key])||m[key]<0))errors.push('KPI 數據有負值或非數字，請核對原報表。');}
 }
 return[...new Set(errors)];
}
export function demoSnapshot(){const defs=[{key:'a999',label:'A999',sourceLabel:'AQ V+D 999（含）以上',unit:'筆'},{key:'r999',label:'R999',sourceLabel:'RT V+D 999（含）以上',unit:'筆'},{key:'r1399',label:'R1399',sourceLabel:'RT V+D 1399（含）以上',unit:'筆'},{key:'broadband',label:'寬頻',sourceLabel:'好速業績點數',unit:'點'},{key:'accessories',label:'配件',sourceLabel:'配件銷售金額',unit:'元'},{key:'film',label:'包膜',sourceLabel:'包膜業績',unit:'元'},{key:'netflix',label:'Netflix',sourceLabel:'Netflix',unit:'筆'}];const people=[['示範一店','同仁甲',960,62.4],['示範一店','同仁乙',830,74.8],['示範二店','同仁丙',725,81.3],['示範二店','同仁丁',680,89.6],['示範三店','同仁戊',521,96.2],['示範三店','同仁己',405,104.8],['示範四店','同仁庚',276,117.5],['示範四店','同仁辛',128,136.2]];return{id:'demo',cutoffDate:'2026-10-21',sourceName:'示範資料・非實際績效',metricDefinitions:defs.map(d=>({...d,targetBasis:"monthly"})),selectedMetricKeys:DEFAULT_KEYS,rule:'overall_and_metric',rows:people.map(([store,name,rank,overallProgress],i)=>({employeeId:'DEMO'+String(i+1).padStart(3,'0'),store,name,job:'業務代表',rank,overallProgress,metrics:Object.fromEntries(defs.map((d,j)=>{const target=j===3?7:j===4?12000:j===5?8000:8+j*5;const actual=j>3&&j<6?Math.round(target*(.25+i*.06+j*.01)/100)*100:Math.floor(target*(.26+i*.07+j*.015));return[d.key,{actual,target}];}))}))};}

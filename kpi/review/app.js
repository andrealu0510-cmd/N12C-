import {DEFAULT_KEYS,DEFAULT_STORES,RULES,escapeHtml as esc,finite,taipeiDate,validDate,period,metricValue,needsReport,numeric,percent,statusClass,sortPeople,validateSnapshot,demoSnapshot} from './core.js';
import {inspectWorkbook,parseSheet} from './parser.js';
import {readReportFile,readReportText} from './import-source.js';
import {validateReport} from './validation.js';
import {mountReport,makeEmptyReport,renderReportPrint,renderContactsPrint} from './report-ui.js';

const API='https://zgpuuliqtrpdjerniyio.supabase.co/functions/v1/n12c-review-api';
const $=id=>document.getElementById(id);
const PREF='n12c_review_preferences_v1', SESSION='n12c_review_session_v1';
const STATUS={pending:'已存檔 · 待主管核實',returned:'已退回修正',approved:'主管已核實'};
const blankSnapshot=()=>({id:null,cutoffDate:'',sourceName:'尚未發布資料',rows:[],metricDefinitions:[]});
let prefs={presets:[],selected:DEFAULT_KEYS};
try{prefs={...prefs,...JSON.parse(localStorage.getItem(PREF)||'{}')};}catch{}
const state={mode:'demo',user:null,token:null,snapshot:demoSnapshot(),keys:Array.isArray(prefs.selected)?[...prefs.selected]:[...DEFAULT_KEYS],rule:'overall_and_metric',sort:'rank-asc',sortMetric:'',query:'',store:'',onlyBehind:false,page:1,pageSize:20,history:[],tab:'reminders',record:null,form:null,reportEmployee:null,reportSnapshot:null,dirty:false,workbook:null,parsed:null,importName:'',importKeys:[],importDateEdited:false,importBasisEdited:false,mappingReady:false,mappingDirty:false,scope:[],savedDemo:new Map(),toastTimer:null,busy:false};
function persistPrefs(){try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{toast('瀏覽器未允許儲存偏好；本次仍可使用。');}}
function toast(message,error=false){$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>$('toast').hidden=true,6000);}
function info(title,html){$('infoTitle').textContent=title;$('infoContent').innerHTML=html;$('infoDialog').showModal();}
function setSession(token){state.token=token;try{if(token)sessionStorage.setItem(SESSION,token);else sessionStorage.removeItem(SESSION);}catch{}}
async function api(action,data={}){const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(state.token?{Authorization:'Bearer '+state.token}:{})},body:JSON.stringify({action,...data}),signal:AbortSignal.timeout(45000)});let result;try{result=await response.json();}catch{throw new Error('服務暫時未回應，請稍後再試。');}if(!response.ok||!result.ok){const error=new Error(result.error||'操作未完成');error.status=response.status;error.errors=result.errors;throw error;}return result;}
function caught(error){toast(error.name==='TimeoutError'?'連線逾時，尚未確認完成，請重新載入查看結果。':error.message||'操作未完成，請重試。',true);}
function adminOnly(){if(state.user?.role==='admin')return true;$('loginDialog').showModal();return false;}
const defs=()=>state.snapshot.metricDefinitions||[];
const selectedDefs=()=>defs().filter(d=>state.keys.includes(d.key));
const eligible=e=>needsReport(e,state.snapshot,state.keys,state.rule);
function normalizedEmployee(employee,snapshot=state.snapshot){return{...employee,metrics:Object.fromEntries((snapshot.metricDefinitions||[]).map(d=>[d.key,metricValue(employee,d,snapshot.cutoffDate)]))};}
function currentRows(){let rows=state.snapshot.rows||[];if(state.store)rows=rows.filter(e=>e.store===state.store);if(state.query){const term=state.query.toLocaleLowerCase();rows=rows.filter(e=>[e.store,e.name,e.employeeId,e.job].join(' ').toLocaleLowerCase().includes(term));}if(state.onlyBehind)rows=rows.filter(eligible);return sortPeople(rows,state.sort,state.sortMetric,state.snapshot);}
function pageRows(){const rows=currentRows();const pages=Math.max(1,Math.ceil(rows.length/state.pageSize));state.page=Math.max(1,Math.min(pages,state.page));return{rows:rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize),total:rows.length,pages};}
function metricOptions(){return defs().map(d=>'<option value="'+esc(d.key)+'">'+esc(d.label)+(d.reminderEligible===false?'（參考）':'')+'</option>').join('');}
function syncMode(){
 const authenticated=state.mode!=='demo';
 $('sessionLabel').textContent=authenticated?(state.user?.role==='admin'?'主管已登入':'同仁 · '+state.user?.employeeId):'操作示範';
 const staff=state.user?.role==='staff';$('confirmReadBox').hidden=!staff||!state.snapshot?.id;$('changePasswordOpen').hidden=!staff;
 $('sessionLabel').classList.toggle('online',authenticated);$('loginOpen').hidden=authenticated;$('logout').hidden=!authenticated;
 $('modeNotice').hidden=authenticated;
 $('uploadStrip').hidden=state.user?.role==='staff';
 $('saveSettings').hidden=state.user?.role==='staff';
 $('accessOpen').hidden=state.user?.role==='staff';
 $('allEmployeeLabel').hidden=state.user?.role==='staff';
 $('employeeSelect').disabled=state.user?.role==='staff';$('reportThreshold').disabled=state.user?.role==='staff';
}
function renderPeriod(){const p=period(state.snapshot.cutoffDate);$('periodMonth').textContent=p?p.month+' 月進度':'資料尚未發布';$('periodDay').textContent=p?p.day:'—';$('periodDays').textContent=p?p.days:'—';$('periodLabel').textContent=p?'截至 '+state.snapshot.cutoffDate:'請上傳並確認資料日期';}
function renderMetrics(){
 const keys=new Set(defs().map(d=>d.key));state.keys=state.keys.filter(k=>keys.has(k));
 $('metricChoices').innerHTML=defs().length?defs().map(d=>'<label class="metric-choice" title="'+esc(d.sourceLabel||d.label)+'"><input type="checkbox" data-metric="'+esc(d.key)+'" '+(state.keys.includes(d.key)?'checked':'')+'><span>'+esc(d.label)+(d.reminderEligible===false?' <small>參考</small>':'')+'</span></label>').join(''):'<p class="muted">上傳 Excel 後，這裡會列出所有可辨識的 KPI。</p>';
 $('selectedCount').textContent='已選 '+state.keys.length+' / '+defs().length+' 項';
 $('sortMetric').innerHTML=metricOptions();if(!defs().some(d=>d.key===state.sortMetric))state.sortMetric=state.keys[0]||defs()[0]?.key||'';$('sortMetric').value=state.sortMetric;
 const stores=[...new Set(state.snapshot.rows.map(e=>e.store))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
 $('storeFilter').innerHTML='<option value="">全部店點</option>'+stores.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
 if(!stores.includes(state.store))state.store='';$('storeFilter').value=state.store;
 $('presetSelect').innerHTML='<option value="">我的常用組合</option>'+prefs.presets.map((p,i)=>'<option value="'+i+'">'+esc(p.name)+'</option>').join('');
 $('deletePreset').hidden=true;
 const rankAvailable=state.snapshot.rows.some(e=>finite(e.rank));
 for(const option of $('sort').options){if(option.value.startsWith('rank'))option.disabled=!rankAvailable;}
 if(!rankAvailable&&state.sort.startsWith('rank'))state.sort='progress-asc';$('sort').value=state.sort;
}
function summaryCard(label,value,unit,sub,tone=''){return'<div class="summary-card '+tone+'"><div class="summary-label">'+label+'</div><div><strong>'+esc(value)+'</strong><span class="unit">'+unit+'</span></div><small>'+esc(sub)+'</small></div>';}
function renderSummary(){const rows=state.snapshot.rows.filter(e=>!state.store||e.store===state.store);const count=rows.filter(eligible).length;const low=rows.filter(e=>finite(e.overallProgress)&&e.overallProgress<100).length;const p=period(state.snapshot.cutoffDate);$('summaryCards').innerHTML=summaryCard('目前檢視人員',rows.length,'人',state.store||'全部店點')+summaryCard('總進度未達 100%',low,'人','依原報表總進度','blue')+summaryCard('符合目前回報條件',count,'人','依自選項目與回報規則','red')+summaryCard('當月時間進度',p?numeric(p.fraction*100)+'%':'—','',p?p.day+' / '+p.days+' 天 · '+state.keys.length+' 個提醒項目':'尚無資料','green');$('queueCount').textContent=String(count);}
function tableMarkup(rows,definitions,exporting=false){
 if(!definitions.length)return'<div class="empty-table">請先勾選今天要提醒的 KPI 項目。</div>';
 if(!rows.length)return'<div class="empty-table">目前範圍沒有符合條件的同仁。</div>';
 const groups=definitions.map(d=>'<th colspan="4" class="group kpi-group">'+esc(d.label)+' <small>('+esc(d.unit||'單位待確認')+')</small>'+(d.reminderEligible===false?'<br><small>僅供參考</small>':'')+'</th>').join('');
 const cols=definitions.map(d=>d.progressKind==='ratio'?'<th>分子件數</th><th>分母件數</th><th>差額</th><th>原表比例</th>':'<th>實績</th><th>目標</th><th>進度差額</th><th>進度達成</th>').join('');
 return '<table class="kpi-table"><thead><tr><th rowspan="2" class="group">原表<br>排名</th><th rowspan="2" class="group">店點</th><th rowspan="2" class="group">同仁／員編</th><th rowspan="2" class="group overall-head">總進度</th>'+groups+(!exporting?'<th rowspan="2" class="group">回報</th>':'')+'</tr><tr>'+cols+'</tr></thead><tbody>'+rows.map(e=>'<tr><td class="rank-cell">'+numeric(e.rank,0)+'</td><td class="store-cell">'+esc(e.store)+'</td><td class="person-cell"><strong>'+esc(e.name)+'</strong><small>'+esc(e.employeeId)+' · '+esc(e.job||'')+'</small></td><td><span class="rate-pill '+statusClass(e.overallProgress)+'">'+percent(e.overallProgress)+'</span></td>'+definitions.map(d=>{const m=metricValue(e,d,state.snapshot.cutoffDate);const gap=m.gap;return'<td>'+numeric(m.actual)+'</td><td>'+numeric(m.target)+'</td><td class="'+(gap>0?'danger-text':gap<0?'good-text':'')+'">'+(finite(gap)?(gap>0?'+':'')+numeric(gap):d.calculation==='source-only'?'依原表':'—')+'</td><td class="group-last"><span class="rate-pill '+(d.reminderEligible===false?'muted':statusClass(m.progress))+'" title="'+esc(m.progressSource)+'">'+percent(m.progress)+'</span></td>';}).join('')+(!exporting?'<td>'+(eligible(e)?'<button class="row-action" data-open-report="'+esc(e.employeeId)+'">需回報</button>':'<span class="muted">—</span>')+'</td>':'')+'</tr>').join('')+'</tbody></table>';
}
function renderDashboard(){const page=pageRows();renderSummary();$('dashboardTable').innerHTML=tableMarkup(page.rows,selectedDefs());$('pageInfo').textContent=state.page+' / '+page.pages+' 頁 · '+page.total+' 人';$('prevPage').disabled=state.page<=1;$('nextPage').disabled=state.page>=page.pages;$('captureDashboard').disabled=!page.rows.length||!state.keys.length;$('printDashboard').disabled=!page.rows.length||!state.keys.length;$('sourceInfo').textContent='截止日 '+(state.snapshot.cutoffDate||'未確認')+' · '+state.snapshot.sourceName+(state.snapshot.rows.length&&!state.snapshot.rows.some(e=>finite(e.rank))?' · 原表排名未辨識':'');$('rule').value=state.rule;}
function render(){syncMode();renderPeriod();renderMetrics();renderDashboard();}
function changeSelection(keys){state.keys=[...new Set(keys)].filter(k=>defs().some(d=>d.key===k));state.page=1;prefs.selected=state.keys;persistPrefs();renderMetrics();renderDashboard();if(state.tab==='reports'&&!state.dirty)populatePeople();}
async function bootstrap(){const data=await api('bootstrap');state.mode='live';state.user=data.user;state.snapshot=data.snapshot||blankSnapshot();state.history=data.history||[];const settings=data.settings||data.snapshot||{};state.keys=settings.selectedMetricKeys?.length?settings.selectedMetricKeys:prefs.selected?.length?prefs.selected:DEFAULT_KEYS;state.rule=settings.rule||'overall_and_metric';state.store='';state.page=1;render();if(state.user.role==='staff'){state.keys=state.keys.filter(k=>defs().some(d=>d.key===k));if(!state.keys.length)state.keys=defs().slice(0,4).map(d=>d.key);render();await switchTab('reminders');await refreshReadStatus();if(state.user.mustChangePassword)$('passwordDialog').showModal();}}
async function switchTab(tab){if(tab==='reports'&&state.user?.role==='staff'&&!(finite(state.snapshot.rows[0]?.overallProgress)&&state.snapshot.rows[0].overallProgress<80)){toast('本次總進度未低於80%，請在頁籤一完成閱讀確認。',true);return;}state.tab=tab;document.querySelectorAll('[data-tab]').forEach(button=>{const active=button.dataset.tab===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});$('panel-reminders').hidden=tab!=='reminders';$('panel-reports').hidden=tab!=='reports';if(tab==='reports'&&!state.form){populatePeople();await loadSelectedReport();}}
function populatePeople(){const all=$('allEmployees').checked||state.user?.role==='staff';const threshold=Number($('reportThreshold').value||80);const rows=state.snapshot.rows.filter(e=>state.user?.role==='staff'||all||(finite(e.overallProgress)&&e.overallProgress<threshold));const current=state.reportEmployee?.employeeId||$('employeeSelect').value;$('employeeSelect').innerHTML=rows.map(e=>'<option value="'+esc(e.employeeId)+'">'+esc(e.store+' · '+e.name+'（'+e.employeeId+'）')+'</option>').join('');if(rows.some(e=>e.employeeId===current))$('employeeSelect').value=current;$('emptyReport').hidden=rows.length>0;$('reportForm').hidden=!rows.length;$('reportActionbar').hidden=!rows.length;$('accessOpen').disabled=!rows.length;}
function canDiscard(){return !state.dirty||window.confirm('目前內容尚未存檔。確定要離開並捨棄這次修改嗎？');}
function reportContext(){return{employee:state.reportEmployee,snapshot:state.reportSnapshot,role:state.user?.role||'staff',nowDate:taipeiDate()};}
function reportSavedState(){const record=state.record;$('reportStatus').className='status-pill '+(record?.status||'');$('reportStatus').textContent=state.dirty?'內容已修改，尚未存檔':record?STATUS[record.status]:'尚未儲存';$('saveLabel').textContent=state.dirty?'內容已修改，請重新檢核並存檔':record?STATUS[record.status]:'尚未存檔';$('saveSub').textContent=record&&!state.dirty?(state.mode==='demo'?'示範操作，沒有寫入正式雲端。':'最後更新 '+new Date(record.updatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})):'請完成必填欄位，系統將逐項檢核。';$('captureReport').disabled=!record||state.dirty;$('captureContacts').disabled=!record||state.dirty||!record.report.contacts?.length;$('saveReport').disabled=record?.status==='approved';$('checkReport').disabled=record?.status==='approved';$('managerPanel').hidden=state.user?.role!=='admin'||!record;const r=record?.review||{};$('reviewManager').value=r.manager||'';$('reviewDate').value=r.nextCheck||'';$('reviewEvidence').value=r.evidence||'';$('reviewCoaching').value=r.coaching||'';}
function mountCurrent(report){state.form?.destroy();state.form=mountReport($('reportForm'),{employee:normalizedEmployee(state.reportEmployee,state.reportSnapshot),snapshot:{...state.reportSnapshot,selectedMetricKeys:state.keys},report,readOnly:state.record?.status==='approved',onChange:value=>{state.dirty=true;$('reportDateSelect').value=value.reportDate;reportSavedState();}});state.dirty=false;$('reportErrors').hidden=true;$('reportForm').hidden=false;reportSavedState();}
async function loadSelectedReport(){
 const id=$('employeeSelect').value;if(!id){state.form?.destroy();state.form=null;state.reportEmployee=null;$('reportForm').innerHTML='';$('managerPanel').hidden=true;return;}
 if(!canDiscard()){$('employeeSelect').value=state.reportEmployee?.employeeId||'';return;}
 const date=$('reportDateSelect').value||taipeiDate();if(!validDate(date)){toast('請選擇有效的回報日期。',true);return;}
 try{$('loadReport').disabled=true;let record=null;if(state.mode==='demo')record=state.savedDemo.get(id+'|'+date)||null;else record=(await api('get_report',{employeeId:id,reportDate:date})).record;
  let snapshot=state.snapshot;if(record&&record.snapshotId!==snapshot.id){snapshot=(await api('snapshot',{id:record.snapshotId})).snapshot;}
  const employee=snapshot.rows.find(e=>e.employeeId===id);if(!employee)throw new Error('這份資料沒有此員編，請換一份資料再開啟。');state.record=record;state.reportSnapshot=snapshot;state.reportEmployee=employee;
  let report=record?.report||makeEmptyReport(employee,snapshot);report.reportDate=date;
  if(!record&&state.mode!=='demo'){const history=(await api('list_reports',{employeeId:id})).records;const previous=history.find(r=>r.reportDate<date);if(previous){report.previous.promise=previous.report.tomorrow.action;report.previous.quantity=previous.report.tomorrow.count;}}
  mountCurrent(report);
 }catch(error){caught(error);}finally{$('loadReport').disabled=false;}
}
function showErrors(errors){state.form?.showErrors(errors);$('reportErrors').hidden=true;if(!errors?.length)return;toast('不予存檔：共 '+errors.length+' 項需要修正。',true);}
function checkCurrent(){if(!state.form)return null;const report=state.form.getValue();const result=validateReport(report,reportContext());showErrors(result.errors);return{report,result};}
async function saveCurrent(){const checked=checkCurrent();if(!checked?.result.ok)return;const button=$('saveReport');button.disabled=true;try{let record;if(state.mode==='demo'){record={id:'demo-report',snapshotId:checked.report.snapshotId,employeeId:checked.report.employeeId,reportDate:checked.report.reportDate,report:checked.report,status:'pending',revision:(state.record?.revision||0)+1,updatedAt:new Date().toISOString()};state.savedDemo.set(record.employeeId+'|'+record.reportDate,record);}else record=(await api('save_report',{report:checked.report,revision:state.record?.revision||0})).record;state.record=record;state.dirty=false;reportSavedState();toast(state.mode==='demo'?'示範檢核通過，可預覽一頁圖片；未寫入正式雲端。':'已存檔，待主管核實。現在可下載一頁圖片。');}catch(error){if(error.errors)showErrors(error.errors);else caught(error);}finally{button.disabled=state.record?.status==='approved';}}
async function reviewCurrent(status){if(!state.record||!adminOnly())return;if(state.dirty){toast('請先儲存或重新載入回報，再進行主管核實。',true);return;}try{const result=await api('review',{id:state.record.id,revision:state.record.revision,status,review:{manager:$('reviewManager').value.trim(),evidence:$('reviewEvidence').value.trim(),coaching:$('reviewCoaching').value.trim(),nextCheck:$('reviewDate').value}});state.record=result.record;mountCurrent(state.record.report);toast(status==='approved'?'已完成主管核實。':'已退回修正，同仁可再次編輯。');}catch(error){caught(error);}}
function renderMapping(parsed){
 const options='<option value="">— 未使用／無欄位 —</option>'+parsed.header.columns.filter(c=>c.labels?.length).map(c=>'<option value="'+c.index+'">'+esc(c.letter+' · '+c.label.slice(0,90))+'</option>').join('');
 const labels={employeeId:'員編',name:'姓名',store:'店點',job:'職稱',rank:'原表排名',overallProgress:'總進度達成率',overallAchievement:'總月達成率',actual:'實績',target:'目標',progress:'進度達成率',achievement:'月達成率',gap:'原表差額'};
 const select=(path,label)=>'<label>'+label+'<select data-map="'+esc(path)+'">'+options+'</select>'+(/progress|achievement/i.test(path)?'<select data-scale="'+esc(path)+'" aria-label="'+label+'百分比格式"><option value="auto">依 Excel 格式辨識 %</option><option value="ratio">數值 0.8 代表 80%</option><option value="percent">數值 80 代表 80%</option></select>':'')+'</label>';
 let html='<div class="mapping-grid">'+Object.keys(labels).slice(0,7).map(k=>select(k,labels[k])).join('')+'</div>';
 for(const d of parsed.metricDefinitions)html+='<div class="mapping-group"><h3>'+esc(d.label)+' <small>'+esc(d.sourceLabel)+'</small></h3><div class="mapping-grid">'+['actual','target','progress','achievement','gap'].map(k=>select('metrics.'+d.key+'.'+k,labels[k])).join('')+'<label>顯示單位<input data-unit="'+esc(d.key)+'" value="'+esc(d.unit)+'" maxlength="12"></label></div></div>';
 $('mappingUI').innerHTML=html;
 for(const element of $('mappingUI').querySelectorAll('[data-map]')){const value=element.dataset.map.split('.').reduce((o,k)=>o?.[k],parsed.mapping);element.value=value?.column??(typeof value==='number'?value:'');}
 for(const element of $('mappingUI').querySelectorAll('[data-scale]')){const value=element.dataset.scale.split('.').reduce((o,k)=>o?.[k],parsed.mapping);element.value=value?.scale||'auto';}
 state.mappingReady=true;
}
function readMapping(){
 const map=structuredClone(state.parsed.mapping);
 if(!state.mappingReady)return map;
 for(const element of $('mappingUI').querySelectorAll('[data-map]')){const path=element.dataset.map.split('.');let obj=map;for(const part of path.slice(0,-1)){obj[part]||={};obj=obj[part];}const scale=$('mappingUI').querySelector('[data-scale="'+element.dataset.map+'"]')?.value||'auto';obj[path.at(-1)]=element.value===''?null:{column:Number(element.value),scale};}
 for(const element of $('mappingUI').querySelectorAll('[data-unit]'))map.metrics[element.dataset.unit].unit=element.value.trim()||'未確認';
 return map;
}
function renderImportChoices(){
 const search=$('importMetricSearch').value.trim().toLocaleLowerCase();
 const priority=[...DEFAULT_KEYS,'accessories','film'];
 const priorityIndex=d=>priority.includes(d.key)?priority.indexOf(d.key):d.reminderEligible===false?100:50;
 const ds=[...(state.parsed?.metricDefinitions||[])].sort((a,b)=>priorityIndex(a)-priorityIndex(b));
 $('importMetricChoices').innerHTML=ds.filter(d=>!search||(d.label+' '+d.sourceLabel).toLocaleLowerCase().includes(search)).map(d=>'<label class="metric-choice" title="'+esc(d.sourceLabel||d.label)+'"><input type="checkbox" data-import-metric="'+esc(d.key)+'" '+(state.importKeys.includes(d.key)?'checked':'')+'><span>'+esc(d.label)+(d.reminderEligible===false?' <small>參考</small>':'')+'</span></label>').join('')||'<p class="muted">'+(ds.length?'沒有符合搜尋的項目。':'判讀完成後，會在這裡列出可選項目。')+'</p>';
}
function parseImport(mapping,reset=false){
 const options={...(mapping?{mapping}:{}),...(state.importDateEdited&&$('cutoffDate').value?{confirmedDate:$('cutoffDate').value}:{})};
 state.parsed=parseSheet(state.workbook,$('sheetSelect').value,options,window.XLSX);
 const parsed=state.parsed;
 if(parsed.detectedDate&&!state.importDateEdited)$('cutoffDate').value=parsed.detectedDate;
 const basis=parsed.metricDefinitions.map(d=>d.targetBasis),evidence=parsed.profile?.basisEvidence||parsed.basisEvidence;
 if(!state.importBasisEdited){
   if(['month','monthly'].includes(evidence?.basis))$('targetBasis').value='monthly';
   else if(evidence?.basis==='toDate')$('targetBasis').value='toDate';
   else if(basis.length&&basis.every(b=>['month','monthly'].includes(b)))$('targetBasis').value='monthly';
   else if(basis.length&&basis.every(b=>b==='toDate'))$('targetBasis').value='toDate';
 }
 state.mappingReady=false;state.mappingDirty=false;$('mappingUI').innerHTML='';
 if($('mappingDetails').open)renderMapping(parsed);
 const stores=[...new Set(parsed.rows.map(e=>e.store))];
 if(reset){state.scope=stores.filter(s=>DEFAULT_STORES.includes(s));if(!state.scope.length)state.scope=stores;}
 else state.scope=state.scope.filter(s=>stores.includes(s));
 $('importStores').innerHTML=stores.map(s=>'<label class="metric-choice"><input type="checkbox" data-import-store="'+esc(s)+'" '+(state.scope.includes(s)?'checked':'')+'>'+esc(s)+'</label>').join('');
 const available=new Set(parsed.metricDefinitions.map(d=>d.key));
 state.importKeys=(reset?state.keys:state.importKeys).filter(k=>available.has(k));
 if(reset&&!state.importKeys.length)state.importKeys=DEFAULT_KEYS.filter(k=>available.has(k));
 if(reset&&!state.importKeys.length)state.importKeys=parsed.metricDefinitions.filter(d=>d.reminderEligible!==false).slice(0,4).map(d=>d.key);
 $('importOptionsDetails').open=!!parsed.rows.length&&!$('targetBasis').value;
 renderImportChoices();renderImportPreview();
}
function importRows(){return(state.parsed?.rows||[]).filter(e=>state.scope.includes(e.store));}
function importProblems(){
 const issues=[...(state.parsed?.errors||[])];
 for(const w of state.parsed?.warnings||[])if(/AMBIGUOUS_PERCENT|FORMULA_WITHOUT_VALUE|AMBIGUOUS_COLUMN|UNKNOWN_UNIT|METRIC_FIELDS_UNMAPPED/.test(w.code))issues.push(w);
 return issues;
}
function renderImportPreview(){
 const parsed=state.parsed;if(!parsed)return;
 const rows=importRows(),p=period($('cutoffDate').value),issues=importProblems();
 const valid=rows.length>0&&parsed.metricDefinitions.length>0&&!issues.length;
 const cards=[['資料截止日',p?p.month+'/'+p.day:'待確認'],['本次同仁',rows.length+' 人'],['店點範圍',state.scope.length+' 店'],['可選項目',parsed.metricDefinitions.length+' 項']];
 $('importRecognition').className='import-recognition '+(valid?'ready':'blocked');
 $('importRecognition').innerHTML=cards.map(([label,value])=>'<div class="recognition-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');
 $('cutoffExplanation').textContent=p?p.year+' 年 '+p.month+' 月 · '+p.day+' / '+p.days+' 天（'+numeric(p.fraction*100)+'%）':'尚未找到報表日期，請在這裡選擇資料截止日。';
 const messages=[];
 if(valid){
   messages.push('<strong>已自動辨識'+(parsed.profile?.label?' · '+esc(parsed.profile.label):'資料')+'</strong>');
   messages.push('<p>員編、姓名、店點與 KPI 已完成對應，請勾選今天要提醒的項目。</p>');
 }else if(parsed.rows.length){
   messages.push('<strong>'+(issues.length?'部分資料尚待確認':'請選擇發布的店點')+'</strong><p>'+(issues.length?esc(issues[0].message):'下方可調整店點範圍。')+'</p>');
 }else{
   messages.push('<strong>尚未找到完整的個人 KPI 資料</strong><p>請選擇 01-01-05 個人達成率明細工作表，或貼上包含報表標題、資料日期、KPI 表頭與同仁資料的完整內容。</p>');
   $('importOptionsDetails').open=true;
 }
 if(!p)messages.push('<p>尚需確認：資料截止日。</p>');
 else if($('cutoffDate').value>taipeiDate())messages.push('<p>資料截止日不能晚於今天。</p>');
 if(valid&&!$('targetBasis').value)messages.push('<p>尚需確認：下方「資料日期與計算方式」中的目標基準。</p>');
 const references=parsed.metricDefinitions.filter(d=>d.reminderEligible===false).length;
 if(references)messages.push('<p>'+references+' 個參考項目可選取顯示，不套用 80%／100% 的落後回報門檻。</p>');
 $('importMessages').innerHTML=messages.join('');
 $('importMessages').classList.toggle('ready',valid);$('importMessages').classList.toggle('blocked',!valid);
 const diagnostics=[...parsed.errors,...parsed.warnings];
 const notes=[...(parsed.profile?.notes||[])];
 if(parsed.metricDefinitions.some(d=>d.calculation==='source-only'&&d.reminderEligible!==false))notes.push('特殊計分或原表精度不足的項目保留原進度；應達量與差額不自行換算。');
 const evidence=parsed.profile?.basisEvidence||parsed.basisEvidence;
 $('importDiagnosticList').innerHTML=(evidence?.basis&&evidence.basis!=='unknown'?'<p>目標基準已依 '+numeric(evidence.sampleCount,0)+' 筆可比對的原表數據核對。</p>':'')+(notes.length?'<ul>'+notes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul>':'')+(diagnostics.length?'<ul>'+diagnostics.slice(0,60).map(m=>'<li>'+esc(m.message)+'</li>').join('')+'</ul>':'<p>未發現缺欄、重複員編或百分比格式問題。</p>');
 const selected=parsed.metricDefinitions.filter(d=>state.importKeys.includes(d.key)),ds=selected.slice(0,6);
 $('importSummary').textContent='本次 '+rows.length+' 人 · 已選 '+selected.length+' 項 · 預覽前 5 位同仁'+(selected.length>6?'，前 6 個項目':'');
 const preview=rows.slice(0,5);
 $('importPreview').innerHTML=preview.length?'<table class="kpi-table"><thead><tr><th>店點</th><th>同仁／員編</th><th>排名</th><th>總進度</th>'+ds.map(d=>'<th>'+esc(d.label)+'<br><small>'+(d.progressKind==='ratio'?'分子 / 分母 / 原表比例':d.reminderEligible===false?'原表參考值':'實績 / 目標 / 進度')+'</small></th>').join('')+'</tr></thead><tbody>'+preview.map(e=>'<tr><td>'+esc(e.store)+'</td><td>'+esc(e.name)+'<br><small>'+esc(e.employeeId)+'</small></td><td>'+numeric(e.rank)+'</td><td>'+percent(e.overallProgress)+'</td>'+ds.map(d=>{const m=e.metrics[d.key]||{};return'<td>'+numeric(m.actual)+' / '+numeric(m.target)+' / '+percent(m.progress)+'</td>';}).join('')+'</tr>').join('')+'</tbody></table>':'<div class="empty-table">尚無可預覽資料</div>';
 $('publishImport').disabled=!valid||!p||$('cutoffDate').value>taipeiDate()||!$('targetBasis').value||!state.importKeys.length||state.mappingDirty;
 if(state.mappingDirty)$('importStatus').textContent='欄位已變更，請先按「重新解析」更新預覽，再確認使用。';
 else if(valid&&!state.importKeys.length)$('importStatus').textContent='請至少選取一個要顯示的項目。';
 else $('importStatus').textContent='';
}
function openWorkbook(workbook,name){
 const inspection=inspectWorkbook(workbook,window.XLSX);
 if(!workbook.SheetNames?.length)throw new Error('這份檔案沒有可讀取的工作表。');
 state.workbook=workbook;state.importName=name;state.importDateEdited=false;state.importBasisEdited=false;state.mappingDirty=false;
 $('importFilename').textContent=name;
 $('sheetSelect').innerHTML=workbook.SheetNames.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');
 $('sheetSelect').value=inspection.recommendedSheet||workbook.SheetNames[0];
 $('cutoffDate').value='';$('targetBasis').value='';$('importConfirmed').checked=false;$('importStatus').textContent='';
 $('importMetricSearch').value='';$('mappingDetails').open=false;$('importDiagnostic').open=false;
 parseImport(undefined,true);$('importDialog').showModal();
}
async function openFile(file){
 if(!file||state.busy)return;
 state.busy=true;
 try{toast('正在自動判讀報表…');const workbook=await readReportFile(file,window.XLSX);openWorkbook(workbook,file.name);if(state.user?.role==='admin'&&state.parsed?.ok&&validDate($('cutoffDate').value)&&$('targetBasis').value&&state.importKeys.length&&!state.mappingDirty){$('importConfirmed').checked=true;await publishImport();}else toast('判讀完成；如有日期或目標基準待確認，請確認後存入雲端。');}
 catch(error){caught(error);}
 finally{state.busy=false;$('fileInput').value='';}
}
async function openPaste(){
 if(state.busy)return;
 state.busy=true;$('parsePaste').disabled=true;$('pasteStatus').textContent='正在判讀貼上的內容…';
 try{
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const workbook=readReportText($('pasteInput').value,window.XLSX);
   openWorkbook(workbook,'Excel 貼上內容');
   $('pasteDialog').close();$('pasteInput').value='';
   if(state.user?.role==='admin'&&state.parsed?.ok&&validDate($('cutoffDate').value)&&$('targetBasis').value&&state.importKeys.length&&!state.mappingDirty){$('importConfirmed').checked=true;await publishImport();}
 }catch(error){$('pasteStatus').textContent=error.message;}
 finally{state.busy=false;$('parsePaste').disabled=false;}
}
async function publishImport(){
 if(!state.parsed)return;
 if(state.mappingDirty){$('importStatus').textContent='欄位已變更，請先按「重新解析」更新預覽，再確認使用。';return;}
 if(!state.user||state.user.role!=='admin'){$('importStatus').textContent='判讀已完成。請先關閉此視窗並登入主管帳號，再上傳這份資料即可發布。';return;}
 if(!$('importConfirmed').checked){$('importStatus').textContent='請勾選確認資料日期與本次提醒項目。';return;}
 if(!$('targetBasis').value){$('importOptionsDetails').open=true;$('importStatus').textContent='請確認目標欄是整月目標，或截至資料日應達量。';return;}
 if(!state.importKeys.length){$('importStatus').textContent='請至少選取一個項目。';return;}
 const date=$('cutoffDate').value;
 const result=parseSheet(state.workbook,$('sheetSelect').value,{mapping:readMapping(),confirmedDate:date},window.XLSX);
 state.parsed=result;
 if(importProblems().length){renderImportPreview();$('importStatus').textContent='資料仍有缺漏或格式問題，尚未發布。';return;}
 const basis=$('targetBasis').value;
 const metricDefinitions=result.metricDefinitions.map(d=>({...d,targetBasis:state.importBasisEdited?basis:d.targetBasis&&d.targetBasis!=='unknown'?d.targetBasis:basis}));
 if(metricDefinitions.some(d=>!d.unit||/未確認/.test(d.unit))){$('importStatus').textContent='仍有項目單位未辨識，尚未發布。';return;}
 const rows=importRows().map(e=>({...e,metrics:Object.fromEntries(metricDefinitions.map(d=>[d.key,{...e.metrics[d.key],targetBasis:d.targetBasis}]))}));
 const snapshot={cutoffDate:date,sourceName:state.importName,sheetName:$('sheetSelect').value,metricDefinitions,rows,selectedMetricKeys:state.importKeys.filter(k=>metricDefinitions.some(d=>d.key===k)),rule:state.rule,importNotes:result.warnings.map(w=>w.message)};
 const errors=validateSnapshot(snapshot);if(errors.length){$('importStatus').textContent=errors.join(' ');return;}
 $('publishImport').disabled=true;$('importStatus').textContent='正在存入雲端，請稍候…';
 try{const saved=await api('upload',{snapshot});state.snapshot=saved.snapshot;state.keys=saved.snapshot.selectedMetricKeys;state.history.unshift({id:saved.snapshot.id,cutoffDate:date,sourceName:state.importName});state.form?.destroy();state.form=null;state.record=null;state.reportEmployee=null;state.dirty=false;state.page=1;render();$('importDialog').close();toast('已發布 '+rows.length+' 位同仁、'+metricDefinitions.length+' 個項目，本次選取 '+state.keys.length+' 項。');}
 catch(error){$('importStatus').textContent=error.message;}
 finally{$('publishImport').disabled=false;}
}
async function canvasFor(html){const stage=$('captureStage');stage.innerHTML=html;await document.fonts.ready;const node=stage.firstElementChild;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return window.html2canvas(node,{backgroundColor:'#ffffff',scale:2,useCORS:false,logging:false,windowWidth:Math.max(node.scrollWidth,1600),windowHeight:Math.max(node.scrollHeight,1000),scrollX:0,scrollY:0});}
function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('圖片產生失敗，請減少每頁人數重試。')),'image/png'));}
function download(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function captureDashboardHTML(definitions,part=1,parts=1){const page=pageRows();const p=period(state.snapshot.cutoffDate);return'<article class="capture-board '+(definitions.length>4?'capture-wide':'')+'"><div class="capture-head"><div><div class="eyebrow">北一二C · 每日績效管理</div><h1>個人 KPI 進度提醒</h1><div class="capture-sub">'+esc(state.store||'全部店點')+' · '+esc(definitions.map(d=>d.label).join(' / '))+'</div>'+(state.mode==='demo'?'<div class="capture-demo">操作示範 · 以下為虛構績效資料</div>':'')+'</div><div class="capture-date">'+esc(state.snapshot.cutoffDate)+'<div class="capture-sub">當月時間進度 '+p.day+' / '+p.days+' 天</div></div></div><div class="capture-rules">回報條件：'+esc(RULES[state.rule])+' ｜ '+esc($('sort').selectedOptions[0].textContent)+'</div>'+tableMarkup(page.rows,definitions,true)+'<div class="capture-foot"><div>差額＝截至資料日應達量－實績（正值落後）<br>紅：&lt;80%　黃：80%–&lt;100%　綠：≥100%　—：無資料／未設目標<br>參考項目不套門檻；「依原表」代表保留評分，差額不自行換算。</div><div>資料：'+esc(state.snapshot.sourceName)+'<br>第 '+state.page+' / '+page.pages+' 頁 · '+page.rows.length+' 人'+(parts>1?' · 項目 '+part+' / '+parts:'')+'</div></div></article>';}
async function exportDashboard(){if(!state.keys.length)return;const button=$('captureDashboard');button.disabled=true;try{const all=selectedDefs();const groups=[];for(let i=0;i<all.length;i+=6)groups.push(all.slice(i,i+6));if(groups.length===1){download(await canvasBlob(await canvasFor(captureDashboardHTML(groups[0]))),'北一二C_KPI提醒_'+state.snapshot.cutoffDate+'_第'+state.page+'頁.png');toast('PNG 已產生；可將圖片上傳到群組。');}else{info('已選 '+all.length+' 項，分張維持可讀性','<p>每張最多 6 個 KPI，這次共 '+groups.length+' 張。請分別點選下載。</p><div id="exportLinks">正在產生圖片…</div>');const list=$('exportLinks');list.innerHTML='';for(let i=0;i<groups.length;i++){const blob=await canvasBlob(await canvasFor(captureDashboardHTML(groups[i],i+1,groups.length)));const link=document.createElement('a');link.className='button';link.style.margin='5px';link.href=URL.createObjectURL(blob);link.download='北一二C_KPI提醒_'+state.snapshot.cutoffDate+'_項目'+(i+1)+'.png';link.textContent='下載第 '+(i+1)+' 張：'+groups[i].map(d=>d.label).join('、');list.append(link);}}}catch(error){caught(error);}finally{button.disabled=false;$('captureStage').innerHTML='';}}
async function exportReport(){if(!state.record||state.dirty)return;const button=$('captureReport');button.disabled=true;try{let html=renderReportPrint({employee:normalizedEmployee(state.reportEmployee,state.reportSnapshot),snapshot:{...state.reportSnapshot,selectedMetricKeys:state.keys},report:state.record.report,record:state.record,review:state.record.review});if(state.mode==='demo')html=html.replace('北一二C · 每日績效管理','北一二C · 操作示範（非正式回報）');const canvas=await canvasFor(html);download(await canvasBlob(canvas),'北一二C_每日改善回報_'+state.record.reportDate+'_'+state.record.employeeId+'.png');toast('清晰的一頁 PNG 已產生，內容未裁切。');}catch(error){caught(error);}finally{button.disabled=false;$('captureStage').innerHTML='';}}
async function exportContacts(){
 if(!state.record||state.dirty)return;
 const contacts=state.record.report.contacts||[];
 if(!contacts.length){toast('當日沒有接觸明細。');return;}
 const button=$('captureContacts');button.disabled=true;
 try{
  const pages=Math.ceil(contacts.length/6);
  info('逐筆接觸明細','<p>每張最多 6 筆，共 '+contacts.length+' 筆、'+pages+' 張。僅包含已填寫的隱碼資料，請逐張下載檢閱。</p><div id="contactExportLinks"></div>');
  const list=$('contactExportLinks');
  for(let page=1;page<=pages;page++){
   const link=document.createElement('button');link.className='button';link.style.margin='5px';link.textContent='下載第 '+page+' 張（'+contacts.slice((page-1)*6,page*6).map(c=>c.code).join('、')+'）';
   link.onclick=async()=>{link.disabled=true;try{let html=renderContactsPrint({employee:normalizedEmployee(state.reportEmployee,state.reportSnapshot),snapshot:state.reportSnapshot,report:state.record.report,record:state.record,page,pageSize:6});if(state.mode==='demo')html=html.replace('北一二C · 逐筆檢閱','北一二C · 操作示範（非正式回報）');download(await canvasBlob(await canvasFor(html)),'北一二C_隱碼接觸明細_'+state.record.reportDate+'_'+state.record.employeeId+'_第'+page+'頁.png');}catch(error){caught(error);}finally{link.disabled=false;$('captureStage').innerHTML='';}};
   list.append(link);
  }
 }catch(error){caught(error);}finally{button.disabled=false;}
}

// Dialogs and navigation
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.tab).catch(caught)));
$('loginOpen').onclick=()=>$('loginDialog').showModal();
$('loginForm').onsubmit=async event=>{event.preventDefault();$('loginError').textContent='';$('loginSubmit').disabled=true;try{const form=event.currentTarget;const data=new FormData(form);const result=await api('login',{username:data.get('username'),password:data.get('password')});setSession(result.token);form.reset();await bootstrap();$('loginDialog').close();toast('已登入，資料會保存至雲端。');}catch(error){$('loginError').textContent=error.message;}finally{$('loginSubmit').disabled=false;}};
$('logout').onclick=()=>{if(!canDiscard())return;setSession(null);try{localStorage.removeItem('n12c_fixed_token_v1');}catch{}location.reload();};
$('demoReset').onclick=()=>{if(!canDiscard())return;state.snapshot=demoSnapshot();state.keys=[...DEFAULT_KEYS];state.rule='overall_and_metric';state.query='';state.store='';state.page=1;$('search').value='';state.form?.destroy();state.form=null;state.dirty=false;render();};
$('metricChoices').onchange=()=>changeSelection([...$('metricChoices').querySelectorAll('input:checked')].map(i=>i.dataset.metric));
document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{const preset=button.dataset.preset;const keys=preset==='all'?defs().map(d=>d.key):preset==='none'?[]:defs().filter(d=>preset==='core'?DEFAULT_KEYS.includes(d.key)||/^(A999|R999|R1399)$|寬頻|好速/.test(d.label):/配件|包膜|保貼/.test(d.label)).map(d=>d.key);changeSelection(keys);});
$('presetSelect').onchange=()=>{const value=$('presetSelect').value;$('deletePreset').hidden=value==='';if(value!==''){const preset=prefs.presets[Number(value)];if(preset){const available=preset.keys.filter(k=>defs().some(d=>d.key===k));changeSelection(available);$('presetSelect').value=value;$('deletePreset').hidden=false;if(available.length<preset.keys.length)toast('部分常用項目不在本次報表中，已列出可用項目。');}}};
$('savePreset').onclick=()=>{if(!state.keys.length){toast('請至少勾選一個項目。',true);return;}$('presetName').value='';$('presetSummary').textContent=selectedDefs().map(d=>d.label).join('、');$('presetDialog').showModal();};
$('presetForm').onsubmit=event=>{event.preventDefault();const name=$('presetName').value.trim();if(!name)return;const existing=prefs.presets.find(p=>p.name===name);if(existing)existing.keys=[...state.keys];else prefs.presets.push({name,keys:[...state.keys]});persistPrefs();renderMetrics();$('presetDialog').close();toast('已儲存常用組合（本瀏覽器）。');};
$('deletePreset').onclick=()=>{const value=$('presetSelect').value;if(value==='')return;prefs.presets.splice(Number(value),1);persistPrefs();renderMetrics();toast('已刪除這個常用組合。');};
$('saveSettings').onclick=async()=>{if(!state.keys.length){toast('請至少選擇一個提醒項目。',true);return;}if(state.mode==='demo'){toast('示範模式的項目可自由選取；登入後可設為全區提醒。');return;}try{await api('settings',{selectedMetricKeys:state.keys,rule:state.rule});toast('已儲存全區提醒項目與回報規則。');}catch(error){caught(error);}};
$('search').oninput=event=>{state.query=event.target.value.trim();state.page=1;renderDashboard();};
$('storeFilter').onchange=event=>{state.store=event.target.value;state.page=1;renderDashboard();};
$('sort').onchange=event=>{state.sort=event.target.value;$('sortMetric').hidden=state.sort!=='metric-asc';state.page=1;renderDashboard();};
$('sortMetric').onchange=event=>{state.sortMetric=event.target.value;state.page=1;renderDashboard();};
$('onlyBehind').onchange=event=>{state.onlyBehind=event.target.checked;state.page=1;renderDashboard();};
$('rule').onchange=event=>{state.rule=event.target.value;state.page=1;renderDashboard();};
$('pageSize').onchange=event=>{state.pageSize=Number(event.target.value);state.page=1;renderDashboard();};
$('prevPage').onclick=()=>{state.page--;renderDashboard();};$('nextPage').onclick=()=>{state.page++;renderDashboard();};
$('ruleHelp').onclick=()=>info('進度與回報規則','<p><strong>時間進度：</strong>資料截止日 ÷ 當月實際天數。10 月 21 日為 21／31。</p><p><strong>月達成率：</strong>月目標基準下，累計實績 ÷ 整月目標。</p><p><strong>進度達成率：</strong>優先顯示原報表數值；未提供時，依已確認的目標基準換算。數量型月目標的應達量＝月目標 × 時間進度。</p><p><strong>目前回報規則：</strong>'+esc(RULES[state.rule])+'。</p><p>原表百分比可能包含權重、封頂或四捨五入；本頁保留原報表進度，不覆寫為自行推算值。未設目標或資料缺漏不當作 0%。</p>');
$('dashboardTable').onclick=async event=>{const button=event.target.closest('[data-open-report]');if(!button)return;if(!canDiscard())return;state.dirty=false;await switchTab('reports');populatePeople();$('employeeSelect').value=button.dataset.openReport;await loadSelectedReport();$('panel-reports').scrollIntoView({behavior:'smooth'});};
$('fileInput').onchange=event=>openFile(event.target.files?.[0]);
$('pasteOpen').onclick=()=>{$('pasteStatus').textContent='';$('pasteDialog').showModal();$('pasteInput').focus();};
$('parsePaste').onclick=openPaste;
$('pasteDialog').addEventListener('close',()=>{$('pasteInput').value='';});
$('sheetSelect').onchange=()=>{state.importDateEdited=false;state.importBasisEdited=false;$('cutoffDate').value='';$('targetBasis').value='';$('importConfirmed').checked=false;parseImport(undefined,true);};
$('applyMapping').onclick=()=>{const mapping=readMapping();parseImport(mapping);$('importConfirmed').checked=false;};
$('mappingDetails').addEventListener('toggle',()=>{if($('mappingDetails').open&&state.parsed?.header&&!state.mappingReady)renderMapping(state.parsed);});
for(const type of ['input','change'])$('mappingUI').addEventListener(type,event=>{if(!event.target.matches('[data-map],[data-scale],[data-unit]'))return;state.mappingDirty=true;$('importConfirmed').checked=false;renderImportPreview();});
$('cutoffDate').onchange=()=>{state.importDateEdited=true;renderImportPreview();$('importConfirmed').checked=false;};
$('targetBasis').onchange=()=>{state.importBasisEdited=true;$('importConfirmed').checked=false;renderImportPreview();};
$('importMetricSearch').oninput=renderImportChoices;
$('importMetricChoices').onchange=event=>{const key=event.target.dataset.importMetric;if(!key)return;state.importKeys=event.target.checked?[...new Set([...state.importKeys,key])]:state.importKeys.filter(k=>k!==key);$('importConfirmed').checked=false;renderImportPreview();};
for(const [id,mode] of [['importCoreMetrics','core'],['importAccessoryMetrics','accessories'],['importAllMetrics','all'],['importNoMetrics','none']])$(id).onclick=()=>{const ds=state.parsed?.metricDefinitions||[];state.importKeys=mode==='none'?[]:ds.filter(d=>mode==='all'||(mode==='accessories'?['accessories','film']:DEFAULT_KEYS).includes(d.key)).map(d=>d.key);$('importMetricSearch').value='';$('importConfirmed').checked=false;renderImportChoices();renderImportPreview();};
$('importStores').onchange=()=>{state.scope=[...$('importStores').querySelectorAll('input:checked')].map(i=>i.dataset.importStore);renderImportPreview();$('importConfirmed').checked=false;};
for(const [id,kind] of [['scopeN12c','n12c'],['scopeAll','all'],['scopeNone','none']])$(id).onclick=()=>{for(const input of $('importStores').querySelectorAll('input'))input.checked=kind==='all'||kind==='n12c'&&DEFAULT_STORES.includes(input.dataset.importStore);$('importStores').dispatchEvent(new Event('change'));};
$('publishImport').onclick=publishImport;
$('historyOpen').onclick=()=>{if(state.mode==='demo'){info('歷史資料','<p>登入並發布資料後，每次上傳都會保存獨立快照，可回到指定日期檢閱。</p>');return;}$('historyList').innerHTML=state.history.length?state.history.map(h=>'<div class="history-row"><div><strong>'+esc(h.cutoffDate)+'</strong><small>'+esc(h.sourceName)+'</small></div><button class="button" data-history="'+esc(h.id)+'">開啟</button></div>').join(''):'<p>尚無已發布資料。</p>';$('historyDialog').showModal();};
$('historyList').onclick=async event=>{const button=event.target.closest('[data-history]');if(!button||!canDiscard())return;try{state.snapshot=(await api('snapshot',{id:button.dataset.history})).snapshot;state.form?.destroy();state.form=null;state.record=null;state.dirty=false;state.keys=state.snapshot.selectedMetricKeys?.length?state.snapshot.selectedMetricKeys:state.keys;render();$('historyDialog').close();toast('已開啟 '+state.snapshot.cutoffDate+' 資料。');}catch(error){caught(error);}};
$('reportThreshold').onchange=async()=>{if(!canDiscard())return;populatePeople();await loadSelectedReport();};
$('allEmployees').onchange=async()=>{if(!canDiscard()){$('allEmployees').checked=!$('allEmployees').checked;return;}state.dirty=false;populatePeople();await loadSelectedReport();};
$('employeeSelect').onchange=()=>loadSelectedReport();
$('loadReport').onclick=()=>loadSelectedReport();
$('reportDateSelect').value=taipeiDate();$('reportDateSelect').max=taipeiDate();
$('reloadReports').onclick=async()=>{if(!canDiscard())return;state.dirty=false;populatePeople();await loadSelectedReport();};
$('checkReport').onclick=()=>{const checked=checkCurrent();if(checked?.result.ok)toast('欄位與數字檢核通過，可存檔送交主管核實。');};
$('saveReport').onclick=saveCurrent;$('approveReport').onclick=()=>reviewCurrent('approved');$('returnReport').onclick=()=>reviewCurrent('returned');
$('captureDashboard').onclick=exportDashboard;$('captureReport').onclick=exportReport;$('captureContacts').onclick=exportContacts;
$('printDashboard').onclick=()=>{const selected=selectedDefs();if(selected.length>6){info('請縮小列印範圍','<p>為維持 A4 橫式的清晰度，請一次選取最多 6 個項目，或使用 PNG 自動分張下載。</p>');return;}$('captureStage').innerHTML=captureDashboardHTML(selected);window.print();};
window.addEventListener('afterprint',()=>$('captureStage').innerHTML='');
$('accessOpen').onclick=()=>{if(state.mode==='demo'){info('同仁如何填報','<p>主管登入並上傳資料後，可為指定同仁產生專屬連結。同仁開啟連結，只能看到與填寫自己的回報；存檔會在主管端同步顯示。</p><p>個人連結有效 7 天，可隨時撤銷。請直接提供給本人。</p>');return;}if(!adminOnly()||!state.reportEmployee)return;$('accessPerson').textContent=state.reportEmployee.store+' · '+state.reportEmployee.name+' · '+state.reportEmployee.employeeId;$('accessResult').hidden=true;$('accessURL').value='';$('accessDialog').showModal();};
$('createAccess').onclick=async()=>{try{const result=await api('create_access',{snapshotId:state.reportSnapshot.id,employeeId:state.reportEmployee.employeeId});const url=new URL(location.href);url.hash='access='+result.token;$('accessURL').value=url.href;$('accessExpiry').textContent='到期：'+new Date(result.expiresAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});$('accessResult').hidden=false;}catch(error){caught(error);}};
$('copyAccess').onclick=async()=>{try{await navigator.clipboard.writeText($('accessURL').value);toast('已複製個人填報連結。');}catch{$('accessURL').select();toast('請複製已選取的連結。');}};
$('revokeAccess').onclick=async()=>{if(!window.confirm('確定撤銷這位同仁目前的所有填報連結？已儲存的回報會保留。'))return;try{await api('revoke_access',{employeeId:state.reportEmployee.employeeId});$('accessResult').hidden=true;toast('已撤銷此人的所有舊連結，可重新產生。');}catch(error){caught(error);}};
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});

async function refreshReadStatus(){if(state.user?.role!=='staff'||!state.snapshot?.id)return;try{const r=await api('read_status',{snapshotId:state.snapshot.id});$('readStatus').textContent=r.confirmedAt?'已於 '+new Date(r.confirmedAt).toLocaleString('zh-TW')+' 確認閱讀':'尚未確認本次報表';$('confirmRead').disabled=!!r.confirmedAt;}catch(error){caught(error);}}
$('confirmRead').onclick=async()=>{try{await api('confirm_read',{snapshotId:state.snapshot.id});await refreshReadStatus();toast('已保存本次閱讀確認。');}catch(error){caught(error);}};
$('changePasswordOpen').onclick=()=>$('passwordDialog').showModal();
$('passwordForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);if(fd.get('newPassword')!==fd.get('repeatPassword')){$('passwordError').textContent='兩次新密碼不同';return;}try{await api('change_password',{oldPassword:fd.get('oldPassword'),newPassword:fd.get('newPassword')});$('passwordError').textContent='密碼已更新，請重新登入。';setSession(null);location.reload();}catch(error){$('passwordError').textContent=error.message;}};

async function init(){render();const access=new URLSearchParams(location.hash.slice(1)).get('access');if(access){setSession('staff:'+access);history.replaceState(null,'',location.pathname+location.search);}else{try{state.token=sessionStorage.getItem(SESSION);if(!state.token){const old=localStorage.getItem('n12c_fixed_token_v1');if(old)state.token='admin:'+old;}}catch{}}if(state.token){try{await bootstrap();}catch(error){setSession(null);if(access){state.mode='live';state.user={role:'staff',employeeId:''};state.snapshot=blankSnapshot();render();info('個人連結無法使用','<p>'+esc(error.message)+'</p>');}else caught(error);}}}
init();

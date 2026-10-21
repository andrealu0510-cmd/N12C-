/** North 12C daily review form. Data is supplied by the authenticated application. */
import { FIELD_LIMITS, REPORT_SCHEMA, REPORT_TEXT_BUDGET, hasUnfinishedWork } from './validation.js';
import { mountContacts, summarizeContactRows, contactCodeIndex } from './contacts-ui.js';
export { renderContactsPrint } from './contacts-ui.js';
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textValue = (value, fallback = '未填') => value === null || value === undefined || value === '' ? fallback : String(value);
const get = (object, path) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], object);
const put = (object, path, value) => { const keys = path.split('.'); let current = object; keys.slice(0, -1).forEach(key => { current[key] ||= {}; current = current[key]; }); current[keys.at(-1)] = value; };
const copy = value => JSON.parse(JSON.stringify(value ?? {}));
const number = value => value === '' || value === null || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = (value, digits = 1) => number(value) === null ? '—' : Number(value).toLocaleString('zh-TW', {maximumFractionDigits:digits});
const pct = value => number(value) === null ? '—' : `${fmt(value)}%`;
const taipeiToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let serial = 0;

export function makeEmptyReport(employee = {}, snapshot = {}) {
  return {reportDate:taipeiToday(),employeeId:String(employee.employeeId ?? employee.employee_id ?? employee.id ?? ''),snapshotId:snapshot.id ?? snapshot.snapshotId ?? '',
    meta:{managerName:'',checkDate:'',remainingWorkdays:''},
    previous:{firstReport:false,promise:'',quantity:'',execution:'',completedQty:'',result:'',unfinished:'',reason:'',remedy:'',deadline:''},
    today:{icebreaker:'',averageMinutes:0,serviceCount:0,billCount:0,renewalCount:0,earlyRenewalCount:0,specialCount:0,dealCount:0,roster:'',priorityMetric:'',action:'',audience:'',actionCount:'',recognizedResult:''},
    contacts:[],
    case:{notApplicable:false,context:'',proposal:'',objection:'',response:'',improvement:'',followup:''},
    tomorrow:{date:'',metric:'',target:'',action:'',audience:'',count:'',roster:'',time:'',help:'',checkTime:''},
    learning:Object.fromEntries(['A999','R1399','broadband'].map(key => [key,{store:'',person:'',question:'',skill:''}])),selfCheck:false};
}

function mergedReport(employee, snapshot, report) {
  const value = makeEmptyReport(employee, snapshot);
  const source = copy(report);
  for (const key of ['reportDate','selfCheck']) if (source[key] !== undefined) value[key] = source[key];
  for (const key of ['meta','previous','today','case','tomorrow']) value[key] = {...value[key], ...(source[key] || {})};
  value.contacts = Array.isArray(source.contacts) ? copy(source.contacts) : [];
  for (const key of ['A999','R1399','broadband']) value.learning[key] = {...value.learning[key], ...(source.learning?.[key] || {})};
  return value;
}

function dataDate(snapshot) { return snapshot.cutoffDate ?? snapshot.dataDate ?? snapshot.data_date ?? snapshot.date ?? snapshot.payload?.cutoffDate ?? ''; }
function definitions(snapshot = {}, employee = {}) {
  const list = snapshot.metricDefinitions ?? snapshot.payload?.metricDefinitions ?? snapshot.metrics;
  if (Array.isArray(list)) return list.map(item => typeof item === 'string' ? {key:item,label:item,unit:''} : item);
  return Object.keys(employee.metrics || {}).map(key => ({key,label:({A999:'A999',R999:'R999',R1399:'R1399',broadband:'寬頻',accessories:'配件',film:'包膜'})[key] || key,unit:employee.metrics[key]?.unit || ''}));
}

function metricRows(employee = {}, snapshot = {}, report = {}) {
  const date = dataDate(snapshot), parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const fraction = parts ? Number(parts[3]) / new Date(Number(parts[1]), Number(parts[2]), 0).getDate() : null;
  const selected = snapshot.selectedMetricKeys ?? snapshot.selectedMetrics ?? snapshot.settings?.selectedMetrics;
  const all = definitions(snapshot, employee).filter(def => employee.metrics?.[def.key]);
  const wanted = Array.isArray(selected) && selected.length ? all.filter(def => selected.includes(def.key)) : all.filter(def => {
    const m = employee.metrics[def.key];
    return number(m.progress) !== null && Number(m.progress) < 100 || def.key === report.today?.priorityMetric || def.key === report.tomorrow?.metric;
  });
  const rows = wanted.length ? wanted : all;
  return rows.map(def => {
    const metric = employee.metrics[def.key] || {}, target = number(metric.target), actual = number(metric.actual);
    const basis = metric.targetBasis ?? def.targetBasis ?? snapshot.targetBasis ?? snapshot.settings?.targetBasis ?? 'unknown';
    const unit = metric.unit ?? def.unit ?? '';
    const sourceOnly = metric.calculation === 'source-only' || def.calculation === 'source-only';
    const ratio = /[%％]|搭售率|占比|比例/.test(`${unit} ${def.label ?? ''}`);
    const expected = sourceOnly ? null : number(metric.expected) ?? (target !== null && ['toDate','to-date','todate','current','daily'].includes(basis) ? target : target !== null && fraction !== null && ['monthly','month'].includes(basis) && !ratio ? target * fraction : null);
    const gap = !sourceOnly && expected !== null && actual !== null ? Math.max(0, expected - actual) : null;
    return {key:def.key,label:def.label ?? def.sourceLabel ?? def.key,unit,actual,target,expected,gap,sourceOnly,progressKind:def.progressKind ?? metric.progressKind ?? null,reminderEligible:def.reminderEligible !== false,progress:number(metric.progress),achievement:number(metric.achievement)};
  });
}

function kpiTable(employee, snapshot, report, print = false) {
  const rows = metricRows(employee, snapshot, report);
  if (!rows.length) return '<p class="rf-note">尚無此同仁的可用 KPI 資料，請先選擇已確認的報表。</p>';
  return `<div class="rf-kpi-scroll"><table class="rf-kpi-table${print ? ' rf-print-table' : ''}"><thead><tr><th scope="col">檢核項目／單位</th><th scope="col">原表目標</th><th scope="col">截至資料日應達</th><th scope="col">累計實績</th><th scope="col">落後差額</th><th scope="col">進度達成率</th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${escapeHTML(row.label)}${row.unit ? `<small>${escapeHTML(row.unit)}</small>` : ''}${row.progressKind === 'ratio' ? '<small>原表比例／僅供參考</small>' : row.reminderEligible ? '' : '<small>僅供參考</small>'}</th><td>${fmt(row.target)}${row.progressKind === 'ratio' ? '<br><small>分母件數</small>' : ''}</td><td>${row.expected === null ? row.sourceOnly ? '依原表' : '待確認' : fmt(row.expected)}</td><td>${fmt(row.actual)}${row.progressKind === 'ratio' ? '<br><small>分子件數</small>' : ''}</td><td class="${row.gap > 0 ? 'rf-negative' : ''}">${row.gap === null ? row.sourceOnly ? '依原表' : '待確認' : fmt(row.gap)}</td><td class="${row.reminderEligible && row.progress !== null && row.progress < 80 ? 'rf-negative' : ''}">${pct(row.progress)}</td></tr>`).join('')}</tbody></table></div>`;
}

const DEFAULT_LIMITS = {
  'meta.managerName':40,'previous.promise':120,'previous.execution':120,'previous.result':100,'previous.unfinished':100,'previous.reason':120,'previous.remedy':120,'previous.deadline':80,
  'today.icebreaker':160,'today.roster':180,'today.action':160,'today.audience':100,'today.recognizedResult':160,
  'case.context':120,'case.proposal':120,'case.objection':120,'case.response':120,'case.improvement':120,'case.followup':100,
  'tomorrow.action':140,'tomorrow.audience':100,'tomorrow.roster':120,'tomorrow.time':80,'tomorrow.help':120,'tomorrow.checkTime':80
};
for (const key of ['A999','R1399','broadband']) Object.assign(DEFAULT_LIMITS, {[`learning.${key}.store`]:40,[`learning.${key}.person`]:40,[`learning.${key}.question`]:120,[`learning.${key}.skill`]:160});

/** Create the editable six-section report. Never persists data itself. */
export function mountReport(container, {employee = {},snapshot = {},report = {},readOnly = false,onChange = () => {},fieldLimits = {}} = {}) {
  const uid = `rf-${++serial}`, initial = mergedReport(employee,snapshot,report), limits = {...DEFAULT_LIMITS,...FIELD_LIMITS,...fieldLimits};
  const legacyWithoutContacts = !Array.isArray(report.contacts) && Number(report.today?.serviceCount) > 0;
  const contactReference = contacts => contacts.length ? `本表隱碼接觸紀錄 ${contacts.length} 筆；代碼 ${contactCodeIndex(contacts)}。逐筆明細另頁檢閱。` : '今日無接觸紀錄；實際原因與處理請見下方今日行動。';
  if (!legacyWithoutContacts) {Object.assign(initial.today,summarizeContactRows(initial.contacts));initial.today.roster=contactReference(initial.contacts);}
  const metrics = definitions(snapshot,employee);
  const idFor = path => `${uid}-${path.replace(/\./g,'-')}`;
  const field = (path,label,options = {}) => {
    const id = idFor(path), value = get(initial,path) ?? '', type = options.type || 'textarea', max = limits[path];
    const attributes = `id="${id}" data-rf-path="${path}" aria-describedby="${id}-hint ${id}-error"${readOnly ? ' disabled' : ''}${options.readOnly ? ' readonly aria-readonly="true"' : ''}`;
    let control;
    if (type === 'select') {
      control = `<select ${attributes}><option value="">請選擇</option>${metrics.map(m => `<option value="${escapeHTML(m.key)}"${value === m.key ? ' selected' : ''}>${escapeHTML(m.label ?? m.sourceLabel ?? m.key)}</option>`).join('')}</select>`;
    } else if (type === 'textarea') {
      control = `<textarea ${attributes} rows="${options.rows || 2}" placeholder="${escapeHTML(options.placeholder || '')}">${escapeHTML(value)}</textarea>`;
    } else {
      control = `<input ${attributes} type="${type}" value="${escapeHTML(value)}"${options.placeholder ? ` placeholder="${escapeHTML(options.placeholder)}"` : ''}${type === 'number' ? ` min="0" step="${options.step ?? 1}" inputmode="${options.step ? 'decimal' : 'numeric'}"` : ''}${type === 'date' ? ` min="${path === 'reportDate' ? escapeHTML(dataDate(snapshot)) : escapeHTML(initial.reportDate)}"${path === 'reportDate' ? ` max="${taipeiToday()}"` : ''}` : ''}>`;
    }
    return `<div class="rf-field${options.wide ? ' rf-wide' : ''}${options.small ? ' rf-small' : ''}" data-rf-field="${path}"><label for="${id}">${escapeHTML(label)}${options.optional ? '<small>選填</small>' : ''}</label>${control}<div class="rf-field-foot"><span class="rf-hint" id="${id}-hint">${escapeHTML(options.hint || '')}</span>${max ? `<span class="rf-count" data-rf-count="${path}"><span>${Array.from(String(value)).length}</span>／${max}</span>` : ''}</div><p class="rf-error" id="${id}-error" hidden></p></div>`;
  };
  const toggle = (path,label,hint) => `<label class="rf-toggle"><input id="${idFor(path)}" type="checkbox" data-rf-path="${path}"${get(initial,path) ? ' checked' : ''}${readOnly ? ' disabled' : ''}><span><strong>${escapeHTML(label)}</strong>${hint ? `<small>${escapeHTML(hint)}</small>` : ''}</span></label>`;
  const section = (n,title,subtitle,body) => `<section class="rf-section" aria-labelledby="${uid}-section-${n}"><header class="rf-section-head"><span class="rf-section-number">${n}</span><div><h3 id="${uid}-section-${n}">${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ''}</div></header><div class="rf-section-body">${body}</div></section>`;
  const info = `<div class="rf-identity"><div><span>店點</span><strong>${escapeHTML(textValue(employee.store))}</strong></div><div><span>填報同仁</span><strong>${escapeHTML(textValue(employee.name ?? employee.displayName))}<small>${escapeHTML(initial.employeeId)}</small></strong></div><div><span>KPI 資料截止日</span><strong>${escapeHTML(textValue(dataDate(snapshot)))}</strong></div><div><span>總進度達成率</span><strong class="${number(employee.overallProgress) !== null && Number(employee.overallProgress) < 100 ? 'rf-negative' : ''}">${pct(employee.overallProgress)}</strong></div></div>`;
  const basic = section('01','基本資料與績效現況','KPI 由已確認的報表帶入；請填寫本次改善檢核安排。',`${info}<div class="rf-grid rf-grid-four">${field('reportDate','填報日期',{type:'date'})}${field('meta.managerName','檢核店長／值班主管',{type:'text',placeholder:'填寫負責核對的主管姓名'})}${field('meta.checkDate','改善檢核日期',{type:'date'})}${field('meta.remainingWorkdays','檢核前本人出勤日數',{type:'number',hint:'依實際班表填寫'})}</div>${kpiTable(employee,snapshot,initial)}<p class="rf-note">一般累計項目依已確認月目標 × 資料日／當月天數換算；特殊評分與參考比例依原表，不另推算應達量或差額。進度百分比保留原表，寬頻請核對認列點數。</p>`);
  const previous = section('02','昨日承諾與今日完成結果','把執行動作與成交結果分開記錄，未完成的承諾須有補救期限。',`${toggle('previous.firstReport','這是首次回報','首次回報請說明原因，可免填昨日承諾。')}<div class="rf-grid" data-rf-conditional="previous"><div class="rf-wide rf-grid">${field('previous.promise','昨日承諾的動作',{placeholder:'寫出昨天承諾做的事情與對象'})}${field('previous.quantity','昨日承諾數量',{type:'number',optional:true})}</div>${field('previous.execution','今日實際完成的動作',{placeholder:'說明做了哪些動作；不要只填「已執行」'})}${field('previous.completedQty','今日完成動作數量',{type:'number',optional:true})}${field('previous.result','今日實際成交／認列成果',{placeholder:'寫出項目與筆數／點數；未成交請據實記錄'})}${field('previous.unfinished','尚未完成的部分',{placeholder:'列出未完成事項；全部完成可填「已完成」'})}</div><div class="rf-grid"><div class="rf-wide">${field('previous.reason','未完成原因／首次回報說明',{placeholder:'寫出具體情況；首次回報請說明尚無昨日承諾',wide:true})}</div><div class="rf-wide rf-grid" data-rf-conditional="remedy">${field('previous.remedy','補救方式',{placeholder:'寫出調整後要做的動作'})}${field('previous.deadline','補救完成時間',{type:'text',placeholder:'例如：明日 15:00 前回聯名單'})}</div></div>`);
  const customerNumbers = [ ['serviceCount','服務客數','依逐筆接觸紀錄自動計算'],['billCount','繳費用戶數',''],['renewalCount','符合續約名單',''],['earlyRenewalCount','提前續約名單',''],['specialCount','特維用戶數',''],['dealCount','實際成交客數','結果為成交的不同客戶人數'] ].map(([key,label,hint]) => field(`today.${key}`,`${label}（人）`,{type:'number',hint,readOnly:true})).join('');
  const today = section('03','今日接觸與銷售執行情形','先逐筆填寫隱碼接觸紀錄，再摘要今日推動落後 KPI 的實際行動。',`${legacyWithoutContacts?'<p class="rf-note rf-note-box">此舊紀錄尚無逐筆接觸明細；原存檔人數先保留，請補齊隱碼紀錄後再存檔。</p>':''}<div data-rf-contacts-container></div><h4 class="rf-subheading">今日服務統計 · 由逐筆紀錄自動計算</h4><div class="rf-number-grid">${customerNumbers}</div><p class="rf-note rf-note-box">每位客戶 1 筆，分類可重疊；分類人數不相加作為服務總人數，成交以不重複客戶人數計。</p><div class="rf-grid">${field('today.icebreaker','今日話術重點摘要',{placeholder:'摘要今日使用的話術重點；每位客戶的原句請在逐筆紀錄填寫',rows:3})}${field('today.averageMinutes','每位客戶平均溝通時間（分鐘）',{type:'number',step:'any',hint:'依各筆溝通時間自動平均',readOnly:true})}</div>${field('today.roster','造冊資料（系統建立）',{hint:'本表使用案件代碼與隱碼識別，可另頁匯出完整逐筆明細。',wide:true,rows:2,readOnly:true})}<h4 class="rf-subheading">針對落後 KPI 的實際行動</h4><div class="rf-grid">${field('today.priorityMetric','今日優先推動的 KPI',{type:'select'})}${field('today.action','主動執行的具體動作',{placeholder:'寫出接觸、確認需求、提案或跟進的實際作法'})}${field('today.audience','執行對象',{type:'text',placeholder:'例如：客群條件或 C01 等案件代碼'})}${field('today.actionCount','執行數量',{type:'number',hint:'填寫本次具體動作的實際執行量'})}${field('today.recognizedResult','實際成交／認列成果',{placeholder:'項目、筆數／點數與可核對結果；0 成交也請據實說明',wide:true})}</div>`);
  const caseBlock = section('04','今日未成交原因與改善作法','選擇最需要檢討的一個案例，寫明限制、當下處理與後續追蹤。',`${toggle('case.notApplicable','今日無適用的未成交案例','仍須在下方說明具體原因。')}<div class="rf-grid">${field('case.context','客戶需求／案件代碼，或無適用案例說明',{placeholder:'用內部代碼說明需求與現況；沒有案例時說明原因',wide:true})}<div class="rf-wide rf-grid" data-rf-conditional="case">${field('case.proposal','當時推薦方案與理由',{placeholder:'寫出方案及與需求的關聯'})}${field('case.objection','未接受的具體原因',{placeholder:'記錄客戶實際顧慮或資格限制'})}${field('case.response','當下如何回應或調整',{placeholder:'寫出本人當時的處理'})}${field('case.improvement','可改善的環節',{placeholder:'下一次準備如何調整'})}${field('case.followup','後續追蹤方式與時間',{placeholder:'填寫聯絡方式、日期與時段',wide:true})}</div></div>`);
  const tomorrow = section('05','下一出勤日追分承諾','承諾必須能執行、能核對，並寫清楚名單、時段及成果。',`<div class="rf-grid rf-grid-three">${field('tomorrow.date','下一出勤日',{type:'date'})}${field('tomorrow.metric','優先追分 KPI',{type:'select'})}${field('tomorrow.target','預計成果（請先選 KPI）',{type:'number',step:'any',hint:'依所選 KPI 的原表單位填寫'})}</div><div class="rf-grid">${field('tomorrow.action','預計執行的具體動作',{placeholder:'寫出明確的接觸、提案、跟進行動'})}${field('tomorrow.count','預計執行數量',{type:'number'})}${field('tomorrow.audience','目標客群',{type:'text',placeholder:'說明篩選條件或需求類型'})}${field('tomorrow.roster','名單來源／紀錄位置',{placeholder:'填可核對的名單來源或內部紀錄'})}${field('tomorrow.time','預計執行時段',{type:'text',placeholder:'例如：10:00–12:00'})}${field('tomorrow.checkTime','成果檢核時間',{type:'text',placeholder:'例如：下一出勤日 17:00'})}${field('tomorrow.help','需要店長協助的事項',{placeholder:'寫出需要的示範、資訊或協助；無需求請說明可自行執行的安排',wide:true})}</div>`);
  const learning = section('06','我今天請益','分別記錄請益店點、對象、內容，以及學到的可用技巧。',`<div class="rf-learning-grid">${[['A999','A999'],['R1399','R1399'],['broadband','寬頻']].map(([key,label]) => `<article class="rf-learning-card"><h4>${label}<span>今日請益</span></h4><div class="rf-grid">${field(`learning.${key}.store`,'請益店點',{type:'text',placeholder:'店點名稱'})}${field(`learning.${key}.person`,'請益對象',{type:'text',placeholder:'對象姓名或職稱'})}</div>${field(`learning.${key}.question`,'請益內容',{placeholder:'實際詢問了什麼問題？',rows:3})}${field(`learning.${key}.skill`,'學習到的技巧',{placeholder:'寫出具體方法，以及要如何用在下一次提案',rows:3})}</article>`).join('')}</div>`);
  container.innerHTML = `<div class="rf-report${readOnly ? ' rf-readonly' : ''}"><div class="rf-error-summary" role="alert" tabindex="-1" hidden></div>${basic}${previous}${today}${caseBlock}${tomorrow}${learning}<div class="rf-confirm">${toggle('selfCheck','我已據實填寫，並確認數據與紀錄可供核對','系統檢核通過代表欄位與數字一致性符合規則；實際內容仍待店長／主管核實。')}</div><div class="rf-review-note"><strong>店長核實與複查</strong><p>同仁存檔後，主管另行核對數據、填寫具體輔導與複查結果；未完成核實前會標示「待主管核實」。</p></div></div>`;
  const controls = [...container.querySelectorAll('[data-rf-path]')];
  let contactsEditor;
  const readValue = () => {
    const value = mergedReport(employee,snapshot,initial);
    controls.forEach(control => put(value,control.dataset.rfPath,control.type === 'checkbox' ? control.checked : control.type === 'number' && control.value !== '' && Number.isFinite(Number(control.value)) ? Number(control.value) : control.value));
    value.contacts=contactsEditor?contactsEditor.getValue():copy(initial.contacts);
    if(!legacyWithoutContacts||value.contacts.length){Object.assign(value.today,summarizeContactRows(value.contacts));value.today.roster=contactReference(value.contacts);}
    return value;
  };
  const refreshConditions = () => {
    const first = container.querySelector('[data-rf-path="previous.firstReport"]')?.checked;
    const retained = ['promise','execution','result','unfinished'].some(key => String(controls.find(item => item.dataset.rfPath === `previous.${key}`)?.value || '').trim());
    container.querySelector('[data-rf-conditional="previous"]').hidden = first && !retained;
    container.querySelector('[data-rf-conditional="remedy"]').hidden = !hasUnfinishedWork(readValue().previous);
    container.querySelector('[data-rf-conditional="case"]').hidden = !!container.querySelector('[data-rf-path="case.notApplicable"]')?.checked;
  };
  const refreshTargetUnit = () => {
    const key = controls.find(item => item.dataset.rfPath === 'tomorrow.metric')?.value;
    const unit = employee.metrics?.[key]?.unit ?? metrics.find(item => item.key === key)?.unit;
    const label = container.querySelector(`[for="${idFor('tomorrow.target')}"]`);
    label.textContent = key ? `預計成果（${unit || '單位待確認'}）` : '預計成果（請先選 KPI）';
  };
  const budget = document.createElement('div');
  budget.className = 'rf-budget';
  budget.innerHTML = `<span>一頁重點回報<span class="rf-budget-note">　保留數據、實際動作、結果與期限</span></span><strong><span data-rf-total>0</span>／${REPORT_TEXT_BUDGET.max} 字</strong>`;
  container.querySelector('.rf-error-summary').after(budget);
  const refreshBudget = value => {
    const total = Object.entries(REPORT_SCHEMA).filter(([,spec]) => ['name','text','result','time'].includes(spec.type)).reduce((sum,[path]) => {
      const text = get(value,path); return sum + (typeof text === 'string' ? Array.from(text.normalize('NFKC').replace(/\p{Cf}/gu,'').replace(/\s+/gu,' ').trim()).length : 0);
    },0);
    budget.querySelector('[data-rf-total]').textContent = total;
    budget.classList.toggle('rf-budget-warning',total > REPORT_TEXT_BUDGET.warning);
    budget.classList.toggle('rf-budget-invalid',total > REPORT_TEXT_BUDGET.max);
  };
  const handleInput = (event) => {
    const control = event.target.closest('[data-rf-path]');
    if (!control || readOnly) return;
    const path = control.dataset.rfPath, count = container.querySelector(`[data-rf-count="${path}"]`);
    if (count) { const length = Array.from(control.value).length; count.querySelector('span').textContent = length; count.classList.toggle('rf-over-limit',length > limits[path]); }
    if (control.type === 'checkbox' || path.startsWith('previous.')) refreshConditions();
    if (path === 'tomorrow.metric') refreshTargetUnit();
    if (path === 'reportDate') ['meta.checkDate','tomorrow.date'].forEach(key => { const input = controls.find(x => x.dataset.rfPath === key); if (input) input.min = control.value; });
    const value = readValue();
    refreshBudget(value);
    onChange(value);
  };
  const handleClick = (event) => {
    const link = event.target.closest('[data-rf-error-link]');
    if (!link) return;
    if ((link.dataset.rfErrorLink || '').startsWith('contacts')) {contactsEditor?.focusError(link.dataset.rfErrorLink);return;}
    const control = controls.find(item => item.dataset.rfPath === link.dataset.rfErrorLink);
    if (control) { control.scrollIntoView({behavior:'smooth',block:'center'}); control.focus({preventScroll:true}); }
  };
  container.addEventListener('input',handleInput);
  container.addEventListener('change',handleInput);
  container.addEventListener('click',handleClick);
  const syncContacts = (rows,shouldNotify=true) => {
    const stats=summarizeContactRows(rows);
    for(const [key,value] of Object.entries(stats)){const control=controls.find(item=>item.dataset.rfPath===`today.${key}`);if(control)control.value=value;}
    const rosterControl=controls.find(item=>item.dataset.rfPath==='today.roster');if(rosterControl)rosterControl.value=contactReference(rows);
    const value=readValue();refreshBudget(value);if(shouldNotify)onChange(value);
  };
  contactsEditor=mountContacts(container.querySelector('[data-rf-contacts-container]'),{contacts:initial.contacts,readOnly,onChange:rows=>syncContacts(rows)});
  if(!legacyWithoutContacts||initial.contacts.length)syncContacts(initial.contacts,false);
  refreshConditions();
  refreshTargetUnit();
  refreshBudget(readValue());
  return {
    getValue:readValue,
    showErrors(errors = []) {
      container.querySelectorAll('.rf-field-invalid').forEach(item => item.classList.remove('rf-field-invalid'));
      controls.forEach(control => control.removeAttribute('aria-invalid'));
      container.querySelectorAll('.rf-error').forEach(item => {item.hidden = true; item.textContent = '';});
      errors.forEach(error => {
        const control = controls.find(item => item.dataset.rfPath === error.path);
        if (!control) return;
        control.setAttribute('aria-invalid','true');
        const wrapper = control.closest('.rf-field');
        wrapper?.classList.add('rf-field-invalid');
        const errorElement = wrapper?.querySelector('.rf-error');
        if (errorElement) {errorElement.textContent = error.message; errorElement.hidden = false;}
      });
      contactsEditor?.showErrors(errors.filter(error=>(error.path||'').startsWith('contacts')));
      const summary = container.querySelector('.rf-error-summary');
      summary.hidden = !errors.length;
      summary.innerHTML = errors.length ? `<strong>不予存檔：請修正以下 ${errors.length} 項內容</strong><ul>${errors.map(error => `<li><button type="button" data-rf-error-link="${escapeHTML(error.path || '')}">${escapeHTML(error.label || error.path || '回報內容')}：${escapeHTML(error.message || '請檢查內容')}</button></li>`).join('')}</ul>` : '';
      if (errors.length) {summary.scrollIntoView({behavior:'smooth',block:'start'}); summary.focus({preventScroll:true});}
    },
    destroy() {contactsEditor?.destroy();container.removeEventListener('input',handleInput);container.removeEventListener('change',handleInput);container.removeEventListener('click',handleClick);}
  };
}

const printPair = (label,value,options = {}) => `<div class="rf-pair${options.full ? ' rf-pair-full' : ''}"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(textValue(value,options.fallback || '未填'))}</dd></div>`;
const printSection = (number,title,body,extra = '') => `<section class="rf-print-section ${extra}"><h2><span>${number}</span>${title}</h2>${body}</section>`;
function printStatus(record) {
  if (!record?.id) return {label:'預覽・尚未存檔',className:'rf-status-draft'};
  if (['approved','verified'].includes(record.status)) return {label:'主管已核實',className:'rf-status-approved'};
  if (['returned','rejected'].includes(record.status)) return {label:'已退回補正',className:'rf-status-returned'};
  return {label:'已存檔・待主管核實',className:'rf-status-pending'};
}

/** Escaped, complete one-page export markup; height is content-driven and never cropped. */
export function renderReportPrint({employee = {},snapshot = {},report = {},record = null,review = null} = {}) {
  const r = mergedReport(employee,snapshot,report), t = r.today, p = r.previous, c = r.case, next = r.tomorrow;
  if(Array.isArray(report.contacts))Object.assign(t,summarizeContactRows(r.contacts));
  const status = printStatus(record), metricLabel = key => definitions(snapshot,employee).find(m => m.key === key)?.label || ({broadband:'寬頻'})[key] || key || '未選擇';
  const targetUnit = employee.metrics?.[next.metric]?.unit ?? definitions(snapshot,employee).find(m => m.key === next.metric)?.unit ?? '單位待確認';
  const date = dataDate(snapshot), parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), fraction = parts ? `${Number(parts[3])}／${new Date(Number(parts[1]),Number(parts[2]),0).getDate()}` : '—';
  const basic = printSection('01','基本資料與績效現況',`<dl class="rf-print-meta">${printPair('填報日期',r.reportDate)}${printPair('店點／同仁',`${textValue(employee.store)}／${textValue(employee.name ?? employee.displayName)}（${r.employeeId}）`)}${printPair('檢核主管',r.meta.managerName)}${printPair('改善檢核日期',r.meta.checkDate)}${printPair('檢核前出勤日數',`${textValue(r.meta.remainingWorkdays)} 日`)}${printPair('總進度達成率',pct(employee.overallProgress))}</dl>${kpiTable(employee,snapshot,r,true)}<p class="rf-print-note">一般累計項目依已確認目標基準計算；特殊評分與參考比例依原表。進度百分比保留原表，改善期限依上方檢核日期。</p>`,'rf-print-basic');
  const previous = printSection('02','昨日承諾與今日完成結果',p.firstReport ? `<dl>${printPair('首次回報說明',p.reason,{full:true})}</dl>` : `<dl>${printPair('昨日承諾',p.promise)}${printPair('承諾數量',p.quantity,{fallback:'未另外指定'})}${printPair('今日執行',p.execution)}${printPair('完成數量',p.completedQty,{fallback:'見執行說明'})}${printPair('成交／認列成果',p.result,{full:true})}${printPair('尚未完成',p.unfinished,{full:true})}${p.reason ? printPair('未完成原因',p.reason,{full:true}) : ''}${p.remedy ? printPair('補救方式',p.remedy,{full:true}) : ''}${p.deadline ? printPair('補救完成時間',p.deadline,{full:true}) : ''}</dl>`);
  const counts = [['服務客數',t.serviceCount],['繳費',t.billCount],['符合續約',t.renewalCount],['提前續約',t.earlyRenewalCount],['特維',t.specialCount],['成交客數',t.dealCount]].map(([label,value]) => `<div><span>${label}</span><strong>${escapeHTML(textValue(value))}<small>人</small></strong></div>`).join('');
  const today = printSection('03','今日接觸與銷售執行情形',`<dl>${printPair('破冰話術',t.icebreaker,{full:true})}${printPair('平均溝通時間',`${textValue(t.averageMinutes)} 分鐘／人`,{full:true})}</dl><div class="rf-print-counts">${counts}</div><p class="rf-print-note">各客群可重疊；成交以不重複客戶人數計。</p><dl>${printPair('隱碼接觸紀錄',`${r.contacts.length} 筆；${contactCodeIndex(r.contacts)}。逐筆明細另頁檢閱。`,{full:true})}${printPair('優先推動 KPI',metricLabel(t.priorityMetric))}${printPair('執行數量',t.actionCount)}${printPair('具體動作',t.action,{full:true})}${printPair('執行對象',t.audience,{full:true})}${printPair('成交／認列成果',t.recognizedResult,{full:true})}</dl>`);
  const caseHTML = printSection('04','今日未成交原因與改善作法',c.notApplicable ? `<dl>${printPair('無適用案例說明',c.context,{full:true})}</dl>` : `<dl>${printPair('需求／案件代碼',c.context,{full:true})}${printPair('推薦方案與理由',c.proposal,{full:true})}${printPair('未接受原因',c.objection,{full:true})}${printPair('當下回應／調整',c.response,{full:true})}${printPair('可改善環節',c.improvement,{full:true})}${printPair('追蹤方式與時間',c.followup,{full:true})}</dl>`);
  const tomorrow = printSection('05','下一出勤日追分承諾',`<dl>${printPair('下一出勤日',next.date)}${printPair('優先追分 KPI',metricLabel(next.metric))}${printPair('預計成果',`${textValue(next.target)} ${targetUnit}`)}${printPair('執行數量',next.count)}${printPair('執行動作',next.action,{full:true})}${printPair('目標客群',next.audience,{full:true})}${printPair('名單來源',next.roster,{full:true})}${printPair('執行時段',next.time)}${printPair('檢核時間',next.checkTime)}${printPair('需要主管協助',next.help,{full:true})}</dl>`);
  const learning = printSection('06','我今天請益',`<table class="rf-print-learning"><thead><tr><th>項目</th><th>請益店點／對象</th><th>請益內容</th><th>學習到的技巧</th></tr></thead><tbody>${[['A999','A999'],['R1399','R1399'],['broadband','寬頻']].map(([key,label]) => {const item = r.learning[key];return `<tr><th>${label}</th><td><strong>${escapeHTML(textValue(item.store))}</strong><br>${escapeHTML(textValue(item.person))}</td><td>${escapeHTML(textValue(item.question))}</td><td>${escapeHTML(textValue(item.skill))}</td></tr>`;}).join('')}</tbody></table>`);
  const reviewData = review || record?.manager_review || record?.review;
  const management = reviewData ? `<section class="rf-print-review"><h2>主管核實與複查</h2><dl>${printPair('核實主管',reviewData.managerName ?? reviewData.reviewer ?? reviewData.manager ?? '')}${printPair('核實狀態',status.label)}${printPair('核對紀錄／主要問題',reviewData.evidence ?? reviewData.problem ?? reviewData.note ?? reviewData.comment ?? '',{full:true})}${printPair('具體輔導與調整',reviewData.coaching ?? reviewData.action ?? reviewData.guidance ?? '',{full:true})}${printPair('下次檢核與應達結果',[reviewData.nextCheck ?? reviewData.nextCheckDate,reviewData.target ?? reviewData.expectedResult].filter(Boolean).join('／'),{full:true})}</dl></section>` : `<section class="rf-print-review rf-print-pending"><h2>主管核實與複查</h2><p>待主管核對數據與執行紀錄，補充具體輔導、改善要求及下次檢核。填表完成不等於改善完成。</p></section>`;
  return `<article class="rf-print-sheet"><header class="rf-print-header"><div><div class="rf-print-brand">北一二C · 每日績效管理</div><h1>個人績效未達標<br><span>每日檢閱暨改善追蹤表</span></h1></div><div class="rf-print-heading-meta"><span class="rf-print-status ${status.className}">${status.label}</span><strong>${escapeHTML(date || '資料日待確認')}</strong><span>當月進度 ${escapeHTML(fraction)}</span></div></header>${basic}<div class="rf-print-columns rf-print-top-columns">${previous}${today}</div><div class="rf-print-columns">${caseHTML}${tomorrow}</div>${learning}${management}<footer class="rf-print-footer"><span>${r.selfCheck ? '同仁已確認：據實填寫，數據與紀錄可供核對。' : '尚待同仁確認。'}　實際內容以主管核實為準。</span><span>${record?.revision ? `版本 ${escapeHTML(record.revision)}` : '表單預覽'}${record?.id ? ` · ${escapeHTML(String(record.id).slice(0,8))}` : ''}</span></footer></article>`;
}

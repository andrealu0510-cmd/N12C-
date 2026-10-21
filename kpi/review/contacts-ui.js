/** Structured, masked customer contacts. No persistence and no real customer defaults. */
import * as Rules from './validation.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (value,fallback='未填') => value === '' || value === null || value === undefined ? fallback : String(value);
const clone = value => JSON.parse(JSON.stringify(value));
const normalize = value => typeof value === 'string' ? value.normalize('NFKC').trim() : '';
const numeric = value => value === '' || value === null || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const CONTACT_CATEGORIES = Object.freeze({bill:'繳費',renewal:'符合續約',earlyRenewal:'提前續約',special:'特維',consult:'諮詢',apply:'申辦',other:'其他'});
export const CONTACT_OUTCOMES = Object.freeze({deal:'成交',noDeal:'未成交',serviceOnly:'純服務',followup:'待追蹤'});
const FALLBACK_LIMITS = {code:16,maskedName:8,phoneMasked:10,icebreaker:80,need:100,proposal:120,result:100,followup:100};
const fieldLimits = () => ({...FALLBACK_LIMITS,...(Rules.CONTACT_FIELD_LIMITS || Rules.CONTACT_LIMITS || {})});
const maxContacts = () => Number(Rules.MAX_CONTACTS ?? Rules.CONTACT_MAX ?? 100);

export function blankContact(code='') {
  return {code,maskedName:'',phoneMasked:'',categories:[],minutes:'',icebreaker:'',need:'',proposal:'',outcome:'',result:'',followup:''};
}

function safeCode(value) {
  const s = normalize(value);
  return /^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(s) && !/\d{7}/.test(s) ? s : '代碼待填／修正';
}
function safeMaskedName(value) {
  const s = normalize(value);
  if (!s) return '';
  if(typeof Rules.isValidMaskedName==='function')return Rules.isValidMaskedName(s)?s:'稱呼隱碼待修正';
  return /^[\p{Script=Han}]{1,2}[○〇ＯO＊*●□×xX]{1,5}$/u.test(s) ? s : '稱呼隱碼待修正';
}
function safePhone(value) {
  const s = normalize(value);
  if (!s) return '';
  if(typeof Rules.isValidMaskedPhone==='function')return Rules.isValidMaskedPhone(s)?s:'電話隱碼待修正';
  return /^09\d{2}\*{3}\d{3}$/.test(s) ? s : '電話隱碼待修正';
}
function obviousUnmaskedData(value) {
  const s = normalize(value);
  if(typeof Rules.containsSensitiveData==='function')return Rules.containsSensitiveData(s);
  return /(?:09(?:[\s-]?\d){8}|\+?886[\s-]?9(?:[\s-]?\d){8}|\b[A-Za-z][1289]\d{8}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/.test(s);
}
function privacySafeText(value) {
  return obviousUnmaskedData(value) ? '此欄含尚未隱碼的識別資料，請修正後匯出。' : text(value);
}

export function summarizeContactRows(contacts=[]) {
  const rows = Array.isArray(contacts) ? contacts : [];
  if(typeof Rules.calculateContactSummary==='function')return Rules.calculateContactSummary(rows);
  const result = {serviceCount:rows.length,billCount:0,renewalCount:0,earlyRenewalCount:0,specialCount:0,dealCount:0,averageMinutes:0};
  const categories = {bill:'billCount',renewal:'renewalCount',earlyRenewal:'earlyRenewalCount',special:'specialCount'};
  let minutes = 0;
  for (const row of rows) {
    for (const [category,key] of Object.entries(categories)) if (Array.isArray(row.categories) && row.categories.includes(category)) result[key]++;
    if (row.outcome === 'deal') result.dealCount++;
    minutes += Math.max(0,numeric(row.minutes) ?? 0);
  }
  result.averageMinutes = rows.length ? Math.round(minutes / rows.length * 10) / 10 : 0;
  return result;
}

export function contactCodeIndex(contacts=[]) {
  const codes = (Array.isArray(contacts) ? contacts : []).map(row=>safeCode(row.code));
  return codes.length ? `${codes.slice(0,5).join('、')}${codes.length > 5 ? `…（共 ${codes.length} 筆）` : ''}` : '本日無接觸紀錄';
}

export function mountContacts(container,{contacts=[],readOnly=false,onChange=()=>{}}={}) {
  let rows = Array.isArray(contacts) ? clone(contacts).map(row=>({...blankContact(),...row,categories:Array.isArray(row.categories)?[...row.categories]:[]})) : [];
  let lastRemoved = null, expanded = new Set(rows.map((_,index)=>index===0?index:-1).filter(x=>x>=0));
  const limits = fieldLimits();
  const uid = `rf-contact-${Math.random().toString(36).slice(2,9)}`;
  const field = (index,key,label,{type='textarea',hint='',placeholder='',optional=false,wide=false}={}) => {
    const path=`contacts.${index}.${key}`, id=`${uid}-${index}-${key}`, value=rows[index][key]??'', max=limits[key];
    let control;
    const attrs=`id="${id}" data-rf-contact-key="${key}" data-rf-contact-index="${index}" data-rf-path="${path}" aria-describedby="${id}-error"${readOnly?' disabled':''}`;
    if(type==='select') control=`<select ${attrs}><option value="">請選擇結果</option>${Object.entries(CONTACT_OUTCOMES).map(([k,name])=>`<option value="${k}"${value===k?' selected':''}>${name}</option>`).join('')}</select>`;
    else if(type==='textarea') control=`<textarea ${attrs} rows="2" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
    else control=`<input ${attrs} type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"${type==='number'?' min="0" step="any" inputmode="decimal"':''}${key==='phoneMasked'?' autocomplete="off" inputmode="text"':''}>`;
    return `<div class="rf-field${wide?' rf-wide':''}" data-rf-field="${path}"><label for="${id}">${label}${optional?'<small>選填</small>':''}</label>${control}<div class="rf-field-foot"><span class="rf-hint">${hint}</span>${max?`<span class="rf-count" data-contact-count="${key}"><span>${Array.from(String(value)).length}</span>／${max}</span>`:''}</div><p class="rf-error" id="${id}-error" hidden></p></div>`;
  };
  const headerMarkup = row => {
    const category = (Array.isArray(row.categories)?row.categories:[]).map(key=>CONTACT_CATEGORIES[key]).filter(Boolean);
    const identity=[safeMaskedName(row.maskedName),safePhone(row.phoneMasked)].filter(Boolean);
    return `<span class="rf-contact-summary-main"><strong>${esc(safeCode(row.code))}</strong><span>${esc(identity.join(' · ')||'使用代碼識別')}</span></span><span class="rf-contact-summary-meta"><span>${esc(category.join('／')||'客群待勾選')}</span><b>${numeric(row.minutes)===null?'時間待填':`${esc(row.minutes)} 分鐘`}</b><span class="rf-contact-outcome rf-contact-outcome-${Object.hasOwn(CONTACT_OUTCOMES,row.outcome)?row.outcome:'empty'}">${CONTACT_OUTCOMES[row.outcome]||'結果待填'}</span></span><span class="rf-contact-chevron" aria-hidden="true">⌄</span>`;
  };
  const render = () => {
    container.innerHTML=`<div class="rf-contacts"><div class="rf-contacts-heading"><div><h4>隱碼接觸紀錄 <span>${rows.length} 筆</span></h4><p>同一位客戶填 1 筆，可勾選多種服務；姓名、電話可留白，只填案件代碼即可。</p></div><div class="rf-contacts-actions"><button type="button" data-contact-command="expand">全部展開</button><button type="button" data-contact-command="collapse">全部收合</button>${readOnly?'':`<button type="button" data-contact-command="add" class="rf-contact-add"${rows.length>=maxContacts()?' disabled':''}>＋ 新增用戶</button>`}</div></div><div class="rf-contact-privacy">姓名請使用「陳○○」；電話請使用「0958***896」。請勿填寫完整姓名、完整電話、身分證字號或詳細地址。</div><p class="rf-error rf-contact-global-error" role="alert" hidden></p>${lastRemoved?`<div class="rf-contact-undo">已移除 ${esc(safeCode(lastRemoved.row.code))}<button type="button" data-contact-command="undo"${rows.length>=maxContacts()?' disabled':''}>復原</button></div>`:''}<div class="rf-contact-list">${rows.length?rows.map((row,index)=>`<details class="rf-contact-card" data-rf-contact-card="${index}"${expanded.has(index)?' open':''}><summary>${headerMarkup(row)}</summary><div class="rf-contact-body"><div class="rf-grid rf-contact-identity-fields">${field(index,'code','案件代碼',{type:'text',placeholder:'例如 C01',hint:'每筆代碼須不同；不要使用電話或證號'})}${field(index,'maskedName','隱碼稱呼',{type:'text',optional:true,placeholder:'陳○○'})}${field(index,'phoneMasked','隱碼電話',{type:'text',optional:true,placeholder:'0958***896'})}</div><fieldset class="rf-contact-categories rf-field" data-rf-field="contacts.${index}.categories"><legend>服務／資格分類（可複選）</legend><div>${Object.entries(CONTACT_CATEGORIES).map(([key,label])=>`<label><input type="checkbox" data-rf-contact-category="${key}" data-rf-contact-index="${index}"${row.categories.includes(key)?' checked':''}${readOnly?' disabled':''}><span>${label}</span></label>`).join('')}</div><p class="rf-error" hidden></p></fieldset><div class="rf-grid">${field(index,'minutes','溝通時間（分鐘）',{type:'number',hint:'依該位客戶實際溝通時間填寫'})}${field(index,'outcome','本次結果',{type:'select'})}${field(index,'icebreaker','實際破冰話術',{placeholder:'記錄對這位客戶說的原句'})}${field(index,'need','確認到的需求',{placeholder:'說明需求或具體服務事項'})}${field(index,'proposal','推薦方案／未提案原因',{placeholder:'記錄方案與理由；純服務請說明未提案的具體原因'})}${field(index,'result','實際執行與成交結果',{placeholder:'記錄項目及筆數／點數；未成交請據實說明'})}${field(index,'followup','後續追蹤方式與時間',{placeholder:'記錄下一步及時段；不需追蹤請說明原因',wide:true})}</div>${readOnly?'':`<div class="rf-contact-remove-row"><button type="button" data-contact-command="remove" data-contact-index="${index}">移除此筆</button></div>`}</div></details>`).join(''):`<div class="rf-contact-empty"><strong>尚無接觸紀錄</strong><p>${readOnly?'這份回報沒有逐筆接觸明細。':'有服務客戶時，按「新增用戶」逐筆回填。今日無服務客戶可保持 0 筆，並在今日行動說明原因。'}</p></div>`}</div><div class="rf-contact-list-footer"><span>最多 ${maxContacts()} 筆；逐筆明細另頁匯出，不佔一頁摘要文字額度。</span>${readOnly||!rows.length?'':`<button type="button" data-contact-command="add"${rows.length>=maxContacts()?' disabled':''}>＋ 新增用戶</button>`}</div></div>`;
    container.querySelectorAll('details[data-rf-contact-card]').forEach(details=>details.addEventListener('toggle',()=>{const i=Number(details.dataset.rfContactCard);if(details.open)expanded.add(i);else expanded.delete(i);}));
  };
  const notify = () => onChange(clone(rows),summarizeContactRows(rows));
  const rememberOpen = () => {expanded=new Set([...container.querySelectorAll('details[open][data-rf-contact-card]')].map(el=>Number(el.dataset.rfContactCard)));};
  const nextCode = () => {const used=new Set(rows.map(row=>normalize(row.code).toUpperCase()));let n=1;while(used.has(`C${String(n).padStart(2,'0')}`))n++;return `C${String(n).padStart(2,'0')}`;};
  const handleInput = event => {
    const input=event.target.closest('[data-rf-contact-key],[data-rf-contact-category]');
    if(!input||readOnly)return;
    event.stopPropagation();
    const index=Number(input.dataset.rfContactIndex), row=rows[index];
    if(!row)return;
    if(input.dataset.rfContactCategory) row.categories=[...container.querySelectorAll(`[data-rf-contact-index="${index}"][data-rf-contact-category]:checked`)].map(el=>el.dataset.rfContactCategory);
    else {
      const key=input.dataset.rfContactKey;
      row[key]=input.type==='number'&&input.value!==''&&Number.isFinite(Number(input.value))?Number(input.value):input.value;
      const counter=input.closest('.rf-field')?.querySelector('.rf-count');
      if(counter){const n=Array.from(String(input.value)).length;counter.querySelector('span').textContent=n;counter.classList.toggle('rf-over-limit',n>limits[key]);}
    }
    const summary=container.querySelector(`[data-rf-contact-card="${index}"]>summary`);if(summary)summary.innerHTML=headerMarkup(row);
    notify();
  };
  const handleClick = event => {
    const button=event.target.closest('[data-contact-command]');if(!button)return;
    event.preventDefault();event.stopPropagation();
    const command=button.dataset.contactCommand;
    if(command==='expand'||command==='collapse'){container.querySelectorAll('details[data-rf-contact-card]').forEach(el=>{el.open=command==='expand';});return;}
    if(readOnly)return;
    rememberOpen();
    if(command==='add'){
      if(rows.length>=maxContacts())return;
      rows.push(blankContact(nextCode()));expanded.add(rows.length-1);render();notify();
      const card=container.querySelector(`[data-rf-contact-card="${rows.length-1}"]`);card?.scrollIntoView({behavior:'smooth',block:'start'});card?.querySelector('input')?.focus({preventScroll:true});
    }else if(command==='remove'){
      const index=Number(button.dataset.contactIndex);lastRemoved={row:rows[index],index};rows.splice(index,1);expanded=new Set([...expanded].filter(i=>i!==index).map(i=>i>index?i-1:i));render();notify();
    }else if(command==='undo'&&lastRemoved){
      if(rows.length>=maxContacts())return;
      const {row,index}=lastRemoved;rows.splice(Math.min(index,rows.length),0,row);lastRemoved=null;expanded=new Set(rows.map((_,i)=>i));render();notify();
    }
  };
  container.addEventListener('input',handleInput);container.addEventListener('change',handleInput);container.addEventListener('click',handleClick);render();
  return {
    getValue:()=>clone(rows),
    showErrors(errors=[]){
      container.querySelectorAll('.rf-field-invalid,.rf-contact-invalid').forEach(el=>el.classList.remove('rf-field-invalid','rf-contact-invalid'));
      container.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
      container.querySelectorAll('.rf-error').forEach(el=>{el.hidden=true;el.textContent='';});
      for(const error of errors){
        const match=/^contacts\.(\d+)\.(.+)$/.exec(error.path||'');
        if(!match){if(error.path==='contacts'){const global=container.querySelector('.rf-contact-global-error');global.textContent=error.message;global.hidden=false;}continue;}
        const index=Number(match[1]), key=match[2], card=container.querySelector(`[data-rf-contact-card="${index}"]`);
        card?.classList.add('rf-contact-invalid');if(card)card.open=true;
        const wrapper=container.querySelector(`[data-rf-field="contacts.${index}.${key}"]`);
        wrapper?.classList.add('rf-field-invalid');wrapper?.querySelectorAll('input,select,textarea').forEach(el=>el.setAttribute('aria-invalid','true'));
        const note=wrapper?.querySelector('.rf-error');if(note){note.textContent=error.message;note.hidden=false;}
      }
    },
    focusError(path){
      const match=/^contacts\.(\d+)\.(.+)$/.exec(path||'');if(!match){container.scrollIntoView({behavior:'smooth',block:'center'});return;}
      const card=container.querySelector(`[data-rf-contact-card="${Number(match[1])}"]`);if(card)card.open=true;
      const wrapper=container.querySelector(`[data-rf-field="${path}"]`);wrapper?.scrollIntoView({behavior:'smooth',block:'center'});wrapper?.querySelector('input,select,textarea')?.focus({preventScroll:true});
    },
    destroy(){container.removeEventListener('input',handleInput);container.removeEventListener('change',handleInput);container.removeEventListener('click',handleClick);}
  };
}

/** One page of complete masked details. page is 1-based; pageSize defaults to six contacts. */
export function renderContactsPrint({employee={},snapshot={},report={},record=null,page=1,pageSize=6}={}) {
  const contacts=Array.isArray(report.contacts)?report.contacts:[], size=Math.max(1,Math.min(6,Math.floor(Number(pageSize)||6))), pages=Math.max(1,Math.ceil(contacts.length/size));
  const pageNumber=Math.min(pages,Math.max(1,Math.floor(Number(page)||1))), start=(pageNumber-1)*size, subset=contacts.slice(start,start+size);
  const status=!record?.id?'預覽・尚未存檔':record.status==='approved'?'主管已核實':record.status==='returned'?'已退回補正':'已存檔・待主管核實';
  const pair=(label,value)=>`<div class="rf-contact-print-pair"><dt>${label}</dt><dd>${esc(privacySafeText(value))}</dd></div>`;
  const cards=subset.map((row,offset)=>{
    const identifiers=[safeMaskedName(row.maskedName),safePhone(row.phoneMasked)].filter(Boolean);
    const category=(Array.isArray(row.categories)?row.categories:[]).map(key=>CONTACT_CATEGORIES[key]).filter(Boolean).join('／');
    return `<section class="rf-contact-print-card"><header><div><span class="rf-contact-print-number">${String(start+offset+1).padStart(2,'0')}</span><strong>${esc(safeCode(row.code))}</strong><span>${esc(identifiers.join(' · ')||'以案件代碼識別')}</span></div><span class="rf-contact-print-result">${CONTACT_OUTCOMES[row.outcome]||'結果待填'}</span></header><div class="rf-contact-print-meta"><span>服務／資格：<b>${esc(category||'未勾選')}</b></span><span>溝通時間：<b>${numeric(row.minutes) === null ? '待填' : esc(Number(row.minutes))} 分鐘</b></span></div><dl>${pair('破冰原句',row.icebreaker)}${pair('確認需求',row.need)}${pair('方案／未提案原因',row.proposal)}${pair('實際結果',row.result)}${pair('後續追蹤／不需追蹤原因',row.followup)}</dl></section>`;
  }).join('');
  return `<article class="rf-print-sheet rf-contact-print-sheet"><header class="rf-print-header"><div><div class="rf-print-brand">北一二C · 逐筆檢閱</div><h1>隱碼接觸紀錄明細</h1><p>${esc(text(employee.store))}／${esc(text(employee.name??employee.displayName))}　員編 ${esc(text(report.employeeId??employee.employeeId))}</p></div><div class="rf-print-heading-meta"><span class="rf-print-status">${status}</span><strong>${esc(text(report.reportDate))}</strong><span>第 ${pageNumber}／${pages} 頁 · 本頁 ${subset.length} 筆／共 ${contacts.length} 筆</span></div></header><div class="rf-contact-print-privacy">僅使用案件代碼與隱碼識別；同一位客戶記 1 筆，分類可重疊。KPI 資料日：${esc(text(snapshot.cutoffDate??snapshot.dataDate??snapshot.date))}</div>${cards||'<div class="rf-contact-print-empty">本日無逐筆接觸紀錄。</div>'}<footer class="rf-print-footer"><span>逐筆明細與每日改善摘要相互對照；實際執行內容仍須主管核實。</span><span>${record?.revision?`版本 ${esc(record.revision)} · `:''}${record?.id?`${esc(String(record.id).slice(0,8))} · `:''}明細 ${pageNumber}／${pages}</span></footer></article>`;
}

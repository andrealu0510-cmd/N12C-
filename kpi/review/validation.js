/**
 * Shared employee-report validation. No DOM, runtime, network, or storage dependencies.
 * Validates structure, consistency and obvious non-answers; it cannot certify that a
 * reported action happened. The server must supply trusted employee/snapshot context
 * and independently enforce authorization. This function never changes its input.
 */

const field = (label, type, required = true, maxLength, options = {}) =>
  Object.freeze({ label, type, required, ...(maxLength ? { maxLength } : {}), ...options });

export const MAX_CONTACTS = 100;
export const CONTACT_CATEGORIES = Object.freeze({
  bill: '繳費', renewal: '符合續約', earlyRenewal: '提前續約',
  special: '特維', consult: '諮詢', apply: '申辦', other: '其他',
});
export const CONTACT_OUTCOMES = Object.freeze({
  deal: '成交', noDeal: '未成交', serviceOnly: '純服務', followup: '待追蹤',
});
export const CONTACT_SCHEMA = Object.freeze({
  code: field('客戶代碼', 'code', true, 16),
  maskedName: field('隱碼稱呼', 'maskedName', false, 8),
  phoneMasked: field('隱碼手機', 'maskedPhone', false, 10),
  categories: field('接觸分類', 'stringArray', true, undefined, { values: Object.freeze(Object.keys(CONTACT_CATEGORIES)) }),
  minutes: field('溝通分鐘數', 'number'),
  icebreaker: field('實際破冰話術', 'text', true, 80),
  need: field('需求或服務目的', 'text', true, 100),
  proposal: field('提案或服務處理', 'text', true, 120),
  outcome: field('接觸結果分類', 'enum', true, undefined, { values: Object.freeze(Object.keys(CONTACT_OUTCOMES)) }),
  result: field('實際結果或未成交原因', 'text', true, 100),
  followup: field('後續動作與時間／無需追蹤原因', 'text', true, 100),
});
export const CONTACT_FIELD_LIMITS = Object.freeze(Object.fromEntries(
  Object.entries(CONTACT_SCHEMA).filter(([, spec]) => spec.maxLength)
    .map(([path, spec]) => [path, spec.maxLength]),
));

export const REPORT_SCHEMA = Object.freeze({
  reportDate: field('填報日期', 'date'),
  employeeId: field('員編', 'id', true, 64),
  snapshotId: field('KPI資料版本', 'id', true, 120),
  'meta.managerName': field('檢核店長／值班主管', 'name', true, 32),
  'meta.checkDate': field('改善檢核日期', 'date'),
  'meta.remainingWorkdays': field('檢核日前本人出勤日數', 'integer'),
  'previous.firstReport': field('首次回報', 'boolean'),
  'previous.promise': field('前次承諾的動作與數量', 'text', 'unlessFirstReport', 100),
  'previous.quantity': field('前次承諾數量', 'quantity', false),
  'previous.execution': field('今日完成的動作與數量', 'text', 'unlessFirstReport', 100),
  'previous.completedQty': field('今日完成數量', 'quantity', false),
  'previous.result': field('今日成交／認列成果', 'result', 'unlessFirstReport', 100),
  'previous.unfinished': field('尚未完成的部分', 'text', 'unlessFirstReport', 80),
  'previous.reason': field('首次回報或未完成原因', 'text', 'firstReportOrUnfinished', 120),
  'previous.remedy': field('補救方式', 'text', 'ifUnfinished', 100),
  'previous.deadline': field('補救完成時間', 'time', 'ifUnfinished', 48),
  'today.icebreaker': field('今日使用的破冰話術', 'text', 'ifServed', 120),
  'today.averageMinutes': field('平均每位溝通分鐘數', 'number'),
  'today.serviceCount': field('服務客數', 'integer'),
  'today.billCount': field('繳費用戶數', 'integer'),
  'today.renewalCount': field('符合續約名單人數', 'integer'),
  'today.earlyRenewalCount': field('提前續約名單人數', 'integer'),
  'today.specialCount': field('特維用戶數', 'integer'),
  'today.dealCount': field('實際成交人數', 'integer'),
  'today.roster': field('造冊資料名稱／位置／附件', 'reference', 'ifServed', 180),
  'today.priorityMetric': field('今日優先推動KPI', 'name', true, 48),
  'today.action': field('今日主動執行動作', 'text', true, 120),
  'today.audience': field('今日執行對象', 'name', true, 80),
  'today.actionCount': field('今日執行數量', 'integer'),
  'today.recognizedResult': field('今日實際成交／認列結果', 'result', true, 120),
  contacts: field('逐筆接觸紀錄', 'contactArray', true, undefined, { maxItems: MAX_CONTACTS, items: CONTACT_SCHEMA }),
  'case.notApplicable': field('今日無適用未成交案例', 'boolean'),
  'case.context': field('客戶需求／無適用案例說明', 'text', true, 120),
  'case.proposal': field('推薦方案與理由', 'text', 'ifCase', 100),
  'case.objection': field('客戶未接受的具體原因', 'text', 'ifCase', 100),
  'case.response': field('當下回應或調整', 'text', 'ifCase', 100),
  'case.improvement': field('可改善的環節', 'text', 'ifCase', 100),
  'case.followup': field('後續追蹤方式與時間', 'text', 'ifCase', 100),
  'tomorrow.date': field('下一出勤日', 'date'),
  'tomorrow.metric': field('下一出勤日追分項目', 'name', true, 48),
  'tomorrow.target': field('下一出勤日目標筆數／點數', 'quantity'),
  'tomorrow.action': field('下一出勤日具體動作', 'text', true, 120),
  'tomorrow.audience': field('下一出勤日目標客群', 'name', true, 80),
  'tomorrow.count': field('下一出勤日執行數量', 'integer'),
  'tomorrow.roster': field('下一出勤日名單來源', 'reference', true, 120),
  'tomorrow.time': field('預計執行時段', 'time', true, 48),
  'tomorrow.help': field('需要店長協助事項', 'text', true, 100),
  'tomorrow.checkTime': field('成果檢核時間', 'time', true, 48),
  'learning.A999.store': field('A999請益店點', 'name', true, 32),
  'learning.A999.person': field('A999請益對象', 'name', true, 24),
  'learning.A999.question': field('A999請益內容', 'text', true, 100),
  'learning.A999.skill': field('A999學習到的技巧', 'text', true, 120),
  'learning.R1399.store': field('R1399請益店點', 'name', true, 32),
  'learning.R1399.person': field('R1399請益對象', 'name', true, 24),
  'learning.R1399.question': field('R1399請益內容', 'text', true, 100),
  'learning.R1399.skill': field('R1399學習到的技巧', 'text', true, 120),
  'learning.broadband.store': field('寬頻請益店點', 'name', true, 32),
  'learning.broadband.person': field('寬頻請益對象', 'name', true, 24),
  'learning.broadband.question': field('寬頻請益內容', 'text', true, 100),
  'learning.broadband.skill': field('寬頻學習到的技巧', 'text', true, 120),
  selfCheck: field('本人核對確認', 'confirmation'),
});

export const FIELD_LIMITS = Object.freeze(Object.fromEntries(
  Object.entries(REPORT_SCHEMA).filter(([, spec]) => spec.maxLength)
    .map(([path, spec]) => [path, spec.maxLength]),
));

// The total helps a complete, untruncated report fit its one-page review view.
export const REPORT_TEXT_BUDGET = Object.freeze({ warning: 2000, max: 2500 });

const NO_ANSWER = new Set([
  '無', '无', '沒有', '没有', '無需求', '沒需求', '客人無需求', '客人沒需求',
  '客人不要', '不知道', '不清楚', '同上', '如上', '以上', '待補', '待填',
  '待確認', '不適用', '無適用案例', '無案例', '沒有案例', '沒有未成交案例',
  '已了解', '已詢問', '已請教', '已學習', '已提醒', '已宣導', '已介紹',
  'na', 'none', 'null', 'undefined', 'test', '測試', '略', '123', '1234',
  '12345', '123456', 'abc', 'abcd', 'abcdef', 'asdf', 'asdfgh', 'qwer', 'qwerty',
]);
const EMPTY_PROMISE = /^(?:我會|我們會|會|再|今天|明天|今後|持續|繼續|積極|努力|加油|加強|用心|認真|盡力|全力|推廣|銷售|推銷|業績|達標|目標|完成|提升|改善|學習|執行|落實|追分|衝刺|請|再接再厲|保持|多多|多|更|的|做好|做到|服務|品質|技巧)+$/u;
const FINISHED = /^(?:完成|已完成|皆完成|都完成|已全部完成|已全數完成|全部完成|全數完成|均已完成|皆已完成|無未完成事項|無未完成項目|無未完成部分|沒有未完成事項|沒有未完成項目|沒有未完成部分|沒有待完成事項|無待補事項|無待完成事項|已完成所有承諾|已完成昨日承諾|所有承諾均已完成)$/u;
const QUANTIFIED_RESULT = /^(?:(?:\d+(?:\.\d+)?)(?:筆|點|台|人|件|次|戶)(?:成交)?|未成交|尚未成交|尚未認列)$/u;
const COUNT_PATHS = ['billCount', 'renewalCount', 'earlyRenewalCount', 'specialCount', 'dealCount'];
const REVIEW_FIELDS = ['review', 'managerReview', 'reviewerId', 'reviewStatus', 'approvedBy'];
const NARRATIVE_PATHS = [
  'previous.promise', 'previous.execution', 'previous.result', 'previous.reason', 'previous.remedy',
  'today.icebreaker', 'today.action', 'today.recognizedResult',
  'case.context', 'case.proposal', 'case.objection', 'case.response', 'case.improvement', 'case.followup',
  'tomorrow.action', 'tomorrow.help',
  ...['A999', 'R1399', 'broadband'].flatMap(key => [`learning.${key}.question`, `learning.${key}.skill`]),
];

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.prototype.hasOwnProperty.call(value, key);
const get = (value, path) => path.split('.').reduce((node, key) => own(node, key) ? node[key] : undefined, value);
const blank = value => value === undefined || value === null || (typeof value === 'string' && !value.trim());
const textOf = value => typeof value === 'string' ? value.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/gu, ' ').trim() : '';
const canonical = value => textOf(value).toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '');
const lengthOf = value => Array.from(value).length;
const idOf = value => typeof value === 'string' ? value.trim() : Number.isSafeInteger(value) ? String(value) : '';

/** Optional customer identifiers use only the explicit masked formats. */
export function isValidMaskedPhone(value) {
  return blank(value) || (typeof value === 'string' && /^09\d{2}\*{3}\d{3}$/.test(value.trim()));
}

export function isValidMaskedName(value) {
  if (blank(value)) return true;
  if (typeof value !== 'string') return false;
  // One Han surname, or a recognized compound surname, followed by masks only.
  // Customers with other names can be represented by their contact code alone.
  return /^(?:\p{Script=Han}|歐陽|司馬|上官|諸葛|夏侯|東方|皇甫|尉遲|公孫|慕容|司徒|司空|令狐|長孫|宇文|南宮|軒轅|端木|百里|呼延|澹臺|太史|仲孫|鍾離|拓跋|獨孤|司寇|申屠|公羊|聞人|赫連|濮陽)[○*]{1,3}$/u.test(value.trim());
}

const PRIVACY_MESSAGES = Object.freeze({
  mobile: '偵測到完整台灣手機號碼，請改為0958***896等隱碼，或僅填客戶代碼。',
  identity: '偵測到完整身分證／居留證格式，請移除完整號碼，改以客戶代碼識別。',
  email: '偵測到完整電子郵件地址，請將帳號部分隱碼，或改以客戶代碼識別。',
});
const PRIVACY_LABELS = Object.freeze({ mobile: '完整手機號碼', identity: '完整身分證／居留證', email: '完整電子郵件' });

function personalDataTypes(value) {
  if (typeof value !== 'string' || !value) return [];
  const text = value.normalize('NFKC').replace(/\p{Cf}/gu, '');
  const types = [];
  // Bounded digit sequences avoid interpreting dates, ordinary employee codes,
  // monetary amounts, or the approved starred phone format as mobile numbers.
  if (/(?<!\d)(?:0[ \t().-]*9(?:[ \t().-]*\d){8}|\+?886[ \t().-]*9(?:[ \t().-]*\d){8})(?!\d)/u.test(text)) types.push('mobile');
  if (/(?<![A-Za-z0-9])[A-Za-z][ \t-]?[1289](?:[ \t-]?\d){8}(?![A-Za-z0-9])/u.test(text)) types.push('identity');
  const emails = text.matchAll(/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gu);
  if ([...emails].some(match => !match[0].split('@')[0].includes('*'))) types.push('email');
  return types;
}

/**
 * Find recognizable complete mobile/ID/email patterns without returning their
 * contents. This is a limited pattern check, not exhaustive personal-data detection.
 * Own data properties are inspected; getters and cyclic references are not read.
 */
export function findPersonalData(value) {
  const issues = [];
  const visited = new WeakSet();
  const visit = (node, path, depth) => {
    if (typeof node === 'string') {
      for (const type of personalDataTypes(node)) issues.push({ path, type, label: PRIVACY_LABELS[type], message: PRIVACY_MESSAGES[type] });
      return;
    }
    if (!node || typeof node !== 'object' || depth > 24 || visited.has(node)) return;
    visited.add(node);
    for (const key of Object.keys(node)) {
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) visit(descriptor.value, path ? `${path}.${key}` : key, depth + 1);
    }
  };
  visit(value, '', 0);
  return issues;
}

export function containsSensitiveData(value) {
  return findPersonalData(value).length > 0;
}

/** Use for manager evidence/coaching text too; never includes the detected value. */
export function findPrivacyIssue(value) {
  const first = personalDataTypes(value)[0];
  return first ? PRIVACY_MESSAGES[first] : null;
}

/**
 * Derive the displayed counters from contact rows. This does not validate rows;
 * validateReport must still reject malformed or contradictory records.
 */
export function calculateContactSummary(contacts) {
  const rows = Array.isArray(contacts) ? contacts : [];
  const summary = { serviceCount: rows.length, billCount: 0, renewalCount: 0, earlyRenewalCount: 0, specialCount: 0, dealCount: 0, averageMinutes: 0 };
  let minutes = 0;
  for (const row of rows) {
    if (!object(row)) continue;
    const categories = Array.isArray(row.categories) ? new Set(row.categories) : new Set();
    for (const [category, key] of Object.entries({ bill: 'billCount', renewal: 'renewalCount', earlyRenewal: 'earlyRenewalCount', special: 'specialCount' })) {
      if (categories.has(category)) summary[key]++;
    }
    if (row.outcome === 'deal') summary.dealCount++;
    const number = numeric(row.minutes);
    if (Number.isFinite(number) && number >= 0) minutes += number;
  }
  if (rows.length) summary.averageMinutes = Math.round((minutes / rows.length) * 10) / 10;
  return summary;
}

function numeric(value, quantity = false) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const pattern = quantity ? /^(\d+(?:\.\d+)?)\s*(?:筆|點|台|人|件|次|戶)?$/u : /^(\d+(?:\.\d+)?)$/u;
  const match = value.trim().match(pattern);
  return match ? Number(match[1]) : NaN;
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function finishedStatement(value) {
  const normalized = canonical(value);
  if (FINISHED.test(normalized)) return true;
  const clauses = textOf(value).split(/[，。；;,\n]/u).map(canonical).filter(Boolean);
  return clauses.length > 1 && clauses.every(clause => FINISHED.test(clause));
}

/** Exact snapshot keys or display labels only; never guess an unrelated KPI. */
export function resolveSnapshotMetric(value, snapshot) {
  if (typeof value !== 'string' || !Array.isArray(snapshot?.metricDefinitions)) return null;
  const normalized = textOf(value).toLowerCase();
  if (!normalized) return null;
  const definitions = snapshot.metricDefinitions.filter(definition => object(definition) && typeof definition.key === 'string' && definition.key.trim());
  const byKey = definitions.filter(definition => textOf(definition.key).toLowerCase() === normalized);
  if (byKey.length === 1) return byKey[0];
  // An ambiguous label is not safe to silently resolve to one of several metrics.
  const byLabel = definitions.filter(definition => typeof definition.label === 'string' && textOf(definition.label).toLowerCase() === normalized);
  return byLabel.length === 1 ? byLabel[0] : null;
}

/** Useful for showing conditional remedy fields in the form. */
export function hasUnfinishedWork(previous = {}) {
  if (!object(previous)) return false;
  const promised = numeric(previous.quantity, true);
  const completed = numeric(previous.completedQty, true);
  if (Number.isFinite(promised) && Number.isFinite(completed) && completed < promised) return true;
  const value = canonical(previous.unfinished);
  return Boolean(value && !finishedStatement(previous.unfinished));
}

function obviousNonAnswer(value) {
  const normalized = canonical(value);
  if (!normalized || !/[\p{L}\p{N}]/u.test(normalized)) return true;
  if (NO_ANSWER.has(normalized) || EMPTY_PROMISE.test(normalized)) return true;
  if (/^(.)\1{3,}$/u.test(normalized)) return true;
  // Only whole-field repetition is rejected. A repeated word inside a useful answer is fine.
  for (let size = 1; size <= Math.min(8, Math.floor(lengthOf(normalized) / 3)); size++) {
    const chars = Array.from(normalized);
    if (chars.length % size === 0 && chars.slice(0, size).join('').repeat(chars.length / size) === normalized) return true;
  }
  return /^(?:asdf|qwer|zxcv|qwerty|1234|abcd)+$/iu.test(normalized);
}

function fieldRequired(spec, report) {
  if (typeof spec.required === 'boolean') return spec.required;
  const previous = object(report.previous) ? report.previous : {};
  switch (spec.required) {
    case 'unlessFirstReport': return previous.firstReport !== true;
    case 'firstReportOrUnfinished': return previous.firstReport === true || hasUnfinishedWork(previous);
    case 'ifUnfinished': return hasUnfinishedWork(previous);
    case 'ifServed': return numeric(get(report, 'today.serviceCount')) !== 0;
    case 'ifCase': return get(report, 'case.notApplicable') !== true;
    default: return false;
  }
}

function validateContacts(contacts, error, warn) {
  if (!Array.isArray(contacts)) {
    error('contacts', '請提供逐筆接觸紀錄；今日未服務客戶時請保留空陣列並說明原因。');
    return;
  }
  if (contacts.length > MAX_CONTACTS) {
    error('contacts', `每份回報最多${MAX_CONTACTS}筆接觸紀錄，請確認是否重複登錄；不會自動刪減。`);
    return;
  }
  const seenCodes = new Map();
  for (let index = 0; index < contacts.length; index++) {
    const row = contacts[index];
    const base = `contacts.${index}`;
    if (!object(row)) {
      error(base, '每筆接觸紀錄須包含代碼、分類、時間與實際處理內容。', `第${index + 1}筆接觸紀錄`);
      continue;
    }
    for (const [key, spec] of Object.entries(CONTACT_SCHEMA)) {
      const value = own(row, key) ? row[key] : undefined;
      const path = `${base}.${key}`;
      const label = `第${index + 1}筆・${spec.label}`;
      if (blank(value)) {
        if (spec.required) error(path, `請填寫${spec.label}。`, label);
        continue;
      }
      if (spec.type === 'number') {
        const minutes = numeric(value);
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) error(path, '請填寫0至1440之間的實際分鐘數，可使用小數。', label);
        continue;
      }
      if (spec.type === 'stringArray') {
        if (!Array.isArray(value) || value.length < 1 || value.length > spec.values.length ||
            value.some(category => typeof category !== 'string' || !spec.values.includes(category)) ||
            new Set(value).size !== value.length) error(path, '請至少選擇一項有效接觸分類，各分類可重疊但不可重複選取。', label);
        continue;
      }
      if (spec.type === 'enum') {
        if (typeof value !== 'string' || !spec.values.includes(value)) error(path, '請選擇成交、未成交、純服務或待追蹤。', label);
        continue;
      }
      if (typeof value !== 'string') {
        error(path, '請填寫文字內容。', label);
        continue;
      }
      const content = textOf(value);
      const count = lengthOf(value.normalize('NFKC').trim());
      const privacyIssue = findPrivacyIssue(value);
      if (privacyIssue) error(path, privacyIssue, label);
      if (count > spec.maxLength) error(path, `目前${count}字，請精簡至${spec.maxLength}字內；內容不會自動刪減。`, label);
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/u.test(value)) error(path, '內容含無法辨識的字元，請重新輸入。', label);
      if (spec.type === 'code') {
        const code = value.trim();
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/.test(code)) error(path, '請使用16字內英數字、底線或短橫線作為代碼，例如C01。', label);
        const normalized = code.toUpperCase();
        if (seenCodes.has(normalized)) error(path, `此代碼與第${seenCodes.get(normalized) + 1}筆重複，請使用不同代碼。`, label);
        else seenCodes.set(normalized, index);
      } else if (spec.type === 'maskedName') {
        if (!isValidMaskedName(value)) error(path, '稱呼只可保留姓氏加○或*，例如陳○○；也可留空，使用客戶代碼識別。', label);
      } else if (spec.type === 'maskedPhone') {
        if (!isValidMaskedPhone(value)) error(path, '手機只可填前4碼＋3個*＋末3碼，例如0958***896；也可留空。', label);
      } else if (spec.type === 'text') {
        if (obviousNonAnswer(content) || lengthOf(canonical(content)) < 3) error(path, '請記錄實際話術、需求、處理或原因，勿僅填無、套話或重複字元。', label);
        if (key === 'followup' && /^(?:無須追蹤|無需追蹤|不需追蹤|不用追蹤|不必追蹤|無後續|不用聯絡|無需聯繫|無須聯繫)$/u.test(canonical(content))) error(path, '如無需追蹤，請補充服務已完成或不需再次聯繫的具體原因。', label);
      }
    }
    const contentPaths = ['icebreaker', 'need', 'proposal', 'result', 'followup'];
    const repetitions = new Map();
    for (const key of contentPaths) {
      const content = canonical(row[key]);
      if (lengthOf(content) >= 6) repetitions.set(content, [...(repetitions.get(content) || []), key]);
    }
    for (const keys of repetitions.values()) if (keys.length >= 4) {
      for (const key of keys) error(`${base}.${key}`, '同一筆紀錄的不同欄位使用完全相同內容，請分別記錄實際需求、處理、結果與追蹤方式。', `第${index + 1}筆・${CONTACT_SCHEMA[key].label}`);
    }
  }
  if (contacts.length && contacts.every(row => object(row) && numeric(row.minutes) === 0)) warn('today.averageMinutes', '逐筆溝通分鐘數皆為0，請確認已記錄實際時間；短暫服務可使用小數。');
}

/**
 * @param {object} report See REPORT_SCHEMA. Dates use YYYY-MM-DD. Numeric strings
 * are accepted without coercing blanks to zero. Quantities may include 筆/點/etc.
 * @param {object} context Trusted {employee, snapshot, role?, nowDate}; employee
 * has employeeId, snapshot has id, cutoffDate, rows. nowDate is the local date.
 * @returns {{ok:boolean, errors:Array<{path:string,label:string,message:string}>, warnings:Array<{path:string,label:string,message:string}>}}
 */
export function validateReport(report, context = {}) {
  const errors = [];
  const warnings = [];
  const add = (list, path, message, label) => {
    if (!list.some(issue => issue.path === path && issue.message === message)) {
      list.push({ path, label: label || REPORT_SCHEMA[path]?.label || path, message });
    }
  };
  const error = (path, message, label) => {
    if (!errors.some(issue => issue.path === path)) add(errors, path, message, label);
  };
  const warn = (path, message, label) => add(warnings, path, message, label);
  if (!object(report)) return { ok: false, errors: [{ path: 'report', label: '回報內容', message: '請填寫完整的回報內容。' }], warnings };
  if (!object(context)) context = {};

  let totalText = 0;
  for (const [path, spec] of Object.entries(REPORT_SCHEMA)) {
    // Contact details have their own field limits, outside the one-page summary budget.
    if (spec.type === 'contactArray') continue;
    const value = get(report, path);
    const required = fieldRequired(spec, report);
    if (blank(value)) {
      if (required) error(path, `請填寫${spec.label}。`);
      continue;
    }
    if (spec.type === 'boolean') {
      if (typeof value !== 'boolean') error(path, '請明確選擇是或否。');
      continue;
    }
    if (spec.type === 'confirmation') {
      if (value !== true) error(path, '請完成本人核對確認後再送出。');
      continue;
    }
    if (spec.type === 'date') {
      if (!isValidDate(value)) error(path, '請填寫有效日期，格式為YYYY-MM-DD。');
      continue;
    }
    if (['integer', 'number', 'quantity'].includes(spec.type)) {
      const number = numeric(value, spec.type === 'quantity');
      if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER ||
          (spec.type === 'integer' && !Number.isSafeInteger(number))) {
        error(path, spec.type === 'integer' ? '請填寫0以上的整數，空白不能代替0。' : '請填寫0以上的有效數字。');
      }
      continue;
    }
    if (spec.type === 'id') {
      const id = idOf(value);
      if (!id || lengthOf(id) > spec.maxLength || /\s/u.test(id)) error(path, '資料識別值無效，請重新選取或載入資料。');
      continue;
    }
    if (typeof value !== 'string') {
      error(path, '請填寫文字內容。');
      continue;
    }
    const content = textOf(value);
    const count = lengthOf(value.normalize('NFKC').trim());
    totalText += count;
    const privacyIssue = findPrivacyIssue(value);
    if (privacyIssue) error(path, privacyIssue);
    if (count > spec.maxLength) {
      error(path, `目前${count}字，請精簡至${spec.maxLength}字內；內容不會自動刪減。`);
      continue;
    }
    if (count >= Math.ceil(spec.maxLength * 0.85)) warn(path, '內容較長，建議保留關鍵動作、數量與結果，方便一頁檢閱。');
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/u.test(value)) {
      error(path, '內容含無法辨識的字元，請重新輸入。');
      continue;
    }
    // Optional, inactive fields can contain an explicit N/A. Still enforce size/type.
    if (!required) continue;
    if (obviousNonAnswer(content) && !(path === 'previous.unfinished' && finishedStatement(content))) {
      error(path, '請填寫具體內容或原因，勿僅填無、套話、符號或重複字元。');
      continue;
    }
    if (['text', 'result'].includes(spec.type)) {
      const meaningful = canonical(content);
      const isResult = spec.type === 'result' && QUANTIFIED_RESULT.test(meaningful);
      const isCompletion = path === 'previous.unfinished' && finishedStatement(content);
      if (lengthOf(meaningful) < 3 && !isResult && !isCompletion) error(path, '請補充具體對象、做法或原因，讓紀錄可檢視。');
    }
    if (spec.type === 'time') {
      const clockLike = content.match(/(?:^|\D)(\d{1,2}):(\d{2})(?!\d)/g) || [];
      if (clockLike.some(clock => {
        const parts = clock.match(/(\d{1,2}):(\d{2})/);
        return Number(parts[1]) > 23 || Number(parts[2]) > 59;
      })) error(path, '時間無效，請確認小時為0–23、分鐘為0–59。');
      if (/^\d{4}-\d{2}-\d{2}/.test(content) && !isValidDate(content.slice(0, 10))) error(path, '時間欄中的日期無效，請重新確認。');
      if (lengthOf(canonical(content)) < 2) error(path, '請填寫可辨識的執行或檢核時間。');
    }
  }

  validateContacts(report.contacts, error, warn);
  if (Array.isArray(report.contacts) && report.contacts.length <= MAX_CONTACTS) {
    const derived = calculateContactSummary(report.contacts);
    for (const [key, expected] of Object.entries(derived)) {
      const actual = numeric(get(report, `today.${key}`));
      if (Number.isFinite(actual) && Math.abs(actual - expected) > 1e-9) {
        error(`today.${key}`, key === 'averageMinutes'
          ? `逐筆紀錄計算的平均為${expected}分鐘（四捨五入至小數1位），請同步更新摘要。`
          : `逐筆接觸紀錄對應${expected}人，請同步更新摘要；各分類依同一筆紀錄分別計數。`);
      }
    }
  }

  const employeeId = idOf(report.employeeId);
  const employee = context.employee;
  const knownEmployeeId = object(employee) ? idOf(employee.employeeId ?? employee.employee_id ?? employee.id) : '';
  if (!knownEmployeeId || knownEmployeeId !== employeeId) error('employeeId', '找不到此員編的有效人員資料，請重新選取人員。');
  else if (employee.active === false || employee.disabled === true) error('employeeId', '此員編目前未開放填報，請聯繫管理者確認。');

  const snapshot = context.snapshot;
  const knownSnapshotId = object(snapshot) ? idOf(snapshot.id ?? snapshot.snapshotId ?? snapshot.snapshot_id) : '';
  if (!knownSnapshotId || knownSnapshotId !== idOf(report.snapshotId)) error('snapshotId', 'KPI資料版本不存在或已不符，請重新載入後填報。');
  if (Array.isArray(snapshot?.rows) && employeeId && !snapshot.rows.some(row => idOf(row?.employeeId ?? row?.employee_id ?? row?.id) === employeeId)) {
    error('employeeId', '此KPI資料版本中找不到該員編，請重新確認人員與資料版本。');
  }
  for (const path of ['today.priorityMetric', 'tomorrow.metric']) {
    if (!blank(get(report, path)) && !resolveSnapshotMetric(get(report, path), snapshot)) {
      error(path, '請選擇這份KPI資料中實際存在且名稱明確的項目。');
    }
  }
  const cutoffDate = snapshot?.cutoffDate ?? snapshot?.cutoff_date ?? snapshot?.dataDate ?? snapshot?.data_date;
  if (isValidDate(report.reportDate) && isValidDate(cutoffDate) && report.reportDate < cutoffDate) error('reportDate', '填報日期不可早於本次KPI資料截止日。');
  if (isValidDate(report.reportDate) && isValidDate(context.nowDate) && report.reportDate > context.nowDate) error('reportDate', '填報日期不可晚於今天。');
  if (isValidDate(get(report, 'meta.checkDate')) && isValidDate(report.reportDate) && report.meta.checkDate < report.reportDate) error('meta.checkDate', '改善檢核日期不可早於填報日期。');
  if (isValidDate(get(report, 'tomorrow.date')) && isValidDate(report.reportDate) && report.tomorrow.date <= report.reportDate) error('tomorrow.date', '下一出勤日須晚於本次填報日期。');
  if (isValidDate(get(report, 'meta.checkDate')) && isValidDate(report.reportDate)) {
    const days = Math.round((Date.parse(`${report.meta.checkDate}T00:00:00Z`) - Date.parse(`${report.reportDate}T00:00:00Z`)) / 86400000) + 1;
    const workdays = numeric(report.meta.remainingWorkdays);
    if (workdays > days && days > 0) error('meta.remainingWorkdays', '出勤日數不可多於填報日至檢核日之間的日數（含當日）。');
  }

  const serviceCount = numeric(get(report, 'today.serviceCount'));
  const averageMinutes = numeric(get(report, 'today.averageMinutes'));
  if (Number.isSafeInteger(serviceCount) && serviceCount >= 0) {
    for (const key of COUNT_PATHS) {
      const count = numeric(get(report, `today.${key}`));
      if (Number.isFinite(count) && count > serviceCount) error(`today.${key}`, '此項人數不可超過當日總服務客數；各分類可重疊，不需相加。');
    }
    if (serviceCount === 0) {
      if (Number.isFinite(averageMinutes) && averageMinutes !== 0) error('today.averageMinutes', '今日服務客數為0，平均溝通時間請填0。');
      const result = textOf(get(report, 'today.recognizedResult'));
      if (lengthOf(canonical(result)) < 8 || QUANTIFIED_RESULT.test(canonical(result))) error('today.recognizedResult', '今日服務客數為0，請說明未接觸用戶的具體原因與實際處理情形。');
    }
    if (Number.isFinite(averageMinutes) && averageMinutes > 1440) error('today.averageMinutes', '每位平均溝通時間不可超過一天，請確認單位為分鐘。');
    else if (Number.isFinite(averageMinutes) && serviceCount * averageMinutes > 1440) warn('today.averageMinutes', '客數與平均時間推算超過一天，請確認人數及時間單位。');
  }

  const previous = object(report.previous) ? report.previous : {};
  const quantity = numeric(previous.quantity, true);
  const completed = numeric(previous.completedQty, true);
  if (previous.firstReport !== true && !blank(previous.quantity) !== !blank(previous.completedQty)) {
    error(blank(previous.quantity) ? 'previous.quantity' : 'previous.completedQty', '承諾數量與完成數量請一併填寫，或以文字完整記錄兩者。');
  }
  if (Number.isFinite(quantity) && Number.isFinite(completed) && completed < quantity && finishedStatement(previous.unfinished)) error('previous.unfinished', '完成數量低於承諾數量，請說明尚未完成部分。');
  if (numeric(get(report, 'tomorrow.target'), true) === 0) warn('tomorrow.target', '下一出勤日追分目標為0，請確認是否符合改善計畫。');
  if (numeric(get(report, 'tomorrow.count')) === 0) warn('tomorrow.count', '下一出勤日執行數量為0，請確認計畫是否可執行。');

  for (const key of ['A999', 'R1399', 'broadband']) {
    const question = canonical(get(report, `learning.${key}.question`));
    const skill = canonical(get(report, `learning.${key}.skill`));
    if (question && lengthOf(question) >= 5 && question === skill) error(`learning.${key}.skill`, '請益問題與學到的技巧相同，請改寫實際學到的做法。');
  }
  const repeated = new Map();
  for (const path of NARRATIVE_PATHS) {
    const spec = REPORT_SCHEMA[path];
    if (!fieldRequired(spec, report)) continue;
    const normalized = canonical(get(report, path));
    if (lengthOf(normalized) < 6) continue;
    repeated.set(normalized, [...(repeated.get(normalized) || []), path]);
  }
  for (const paths of repeated.values()) {
    const domains = new Set(paths.map(path => path.split('.')[0]));
    // Reusing a real action across promise/execution is legitimate. Only broad,
    // verbatim copying across several different kinds of questions is blocked.
    if (paths.length >= 4 && domains.size >= 3) for (const path of paths) error(path, '多個不同問題使用完全相同內容，請分別填寫實際行動、原因或學習技巧。');
    else if (paths.length >= 3 && paths.every(path => /^learning\..+\.skill$/.test(path))) warn(paths[0], '三項學習技巧完全相同，請確認各項可實際運用的做法。');
  }

  for (const key of REVIEW_FIELDS) if (own(report, key)) error(key, '管理者核實須由管理端另行紀錄，員工回報不可填入此欄。', '管理者核實');
  if (totalText > REPORT_TEXT_BUDGET.max) error('report', `文字共${totalText}字，請精簡至${REPORT_TEXT_BUDGET.max}字內以利一頁檢閱；內容不會自動刪減。`, '回報總字數');
  else if (totalText > REPORT_TEXT_BUDGET.warning) warn('report', `文字共${totalText}字，建議精簡重複內容，保留可核對的重點。`, '回報總字數');

  return { ok: errors.length === 0, errors, warnings };
}


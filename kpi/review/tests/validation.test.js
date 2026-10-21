import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, hasUnfinishedWork, isValidDate, resolveSnapshotMetric, FIELD_LIMITS, REPORT_TEXT_BUDGET, CONTACT_FIELD_LIMITS, MAX_CONTACTS, calculateContactSummary, isValidMaskedName, isValidMaskedPhone, findPersonalData, findPrivacyIssue, containsSensitiveData } from '../validation.js';
import { makeValidReport, makeValidContext } from './validation-fixtures.js';

const check = report => validateReport(report, makeValidContext());
const paths = result => result.errors.map(error => error.path);

test('complete report is accepted without changing input', () => {
  const report = makeValidReport(); const before = JSON.stringify(report);
  const result = check(report);
  assert.deepEqual(result, { ok: true, errors: [], warnings: [] });
  assert.equal(JSON.stringify(report), before);
});

test('empty or non-object reports are rejected and do not throw', () => {
  for (const report of [undefined, null, '', [], 1, {}]) assert.equal(check(report).ok, false);
  assert.ok(paths(check({})).includes('today.serviceCount'));
});

test('plain encouragement, empty answers, punctuation and obvious gibberish are rejected', () => {
  for (const bad of ['加油努力', '持續努力加強銷售', '無', '無需求', '。！？', 'asdfasdf', '啊啊啊啊啊', '詢問詢問詢問']) {
    const report = makeValidReport(); report.today.action = bad;
    assert.ok(paths(check(report)).includes('today.action'), bad);
  }
});

test('useful answers containing common encouragement words remain valid', () => {
  const report = makeValidReport();
  report.today.action = '先問家中是否常有視訊卡頓，再努力比較適合的速度';
  assert.equal(check(report).ok, true);
});

test('short but specific actions, audiences and roster references remain valid', () => {
  const report = makeValidReport();
  report.today.action = '查供裝'; report.today.audience = '繳費客';
  report.today.roster = '附件1'; report.tomorrow.roster = 'A1';
  assert.equal(check(report).ok, true);
});

test('verbatim boilerplate across unrelated sections is rejected', () => {
  const report = makeValidReport();
  const repeated = '先了解需求再介紹合適方案並約定時間追蹤';
  report.today.action = repeated; report.case.response = repeated;
  report.tomorrow.action = repeated; report.learning.A999.skill = repeated;
  const result = check(report);
  assert.equal(result.ok, false); assert.ok(paths(result).includes('today.action'));
});

test('reusing the same action in the promise and execution is allowed', () => {
  const report = makeValidReport(); report.previous.execution = report.previous.promise;
  assert.equal(check(report).ok, true);
});

test('category counts may overlap and are not summed', () => {
  const report = makeValidReport();
  report.contacts = report.contacts.slice(0, 5);
  report.contacts.forEach((contact, index) => { contact.categories = ['bill', 'renewal', ...(index < 4 ? ['earlyRenewal'] : []), ...(index < 3 ? ['special'] : [])]; });
  Object.assign(report.today, calculateContactSummary(report.contacts));
  assert.deepEqual([report.today.serviceCount, report.today.billCount, report.today.renewalCount, report.today.earlyRenewalCount, report.today.specialCount], [5, 5, 5, 4, 3]);
  assert.equal(check(report).ok, true);
});

test('category and deal counts cannot exceed distinct service count', () => {
  for (const key of ['billCount', 'renewalCount', 'earlyRenewalCount', 'specialCount', 'dealCount']) {
    const report = makeValidReport(); report.today[key] = report.today.serviceCount + 1;
    assert.ok(paths(check(report)).includes(`today.${key}`));
  }
});

test('negative, fractional, blank and unsafe counts are rejected', () => {
  for (const bad of [-1, 1.5, '', ' ', '2.3', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const report = makeValidReport(); report.today.serviceCount = bad;
    assert.ok(paths(check(report)).includes('today.serviceCount'), String(bad));
  }
});

test('numeric input strings are accepted without coercing blank to zero', () => {
  const report = makeValidReport(); report.today.serviceCount = '8';
  report.today.averageMinutes = '6.5'; report.contacts[0].minutes = '10'; report.tomorrow.target = '1.5點';
  assert.equal(check(report).ok, true);
});

test('zero deals are valid when real work and non-sale reasons are recorded', () => {
  const report = makeValidReport(); report.today.dealCount = 0;
  report.contacts[0].outcome = 'noDeal'; report.contacts[0].result = '用戶需再確認家庭預算，今日未成交';
  report.today.recognizedResult = '0筆'; report.previous.result = '0筆';
  assert.equal(check(report).ok, true);
});

test('zero service is valid with a concrete explanation and no fabricated interaction', () => {
  const report = makeValidReport();
  report.contacts = [];
  Object.assign(report.today, { serviceCount: 0, billCount: 0, renewalCount: 0, earlyRenewalCount: 0, specialCount: 0, dealCount: 0, averageMinutes: 0, icebreaker: '', roster: '', action: '盤點到期名單並安排下一出勤日回訪', recognizedResult: '今日全天支援教育訓練未接客，已整理3筆到期名單' });
  report.case = { notApplicable: true, context: '今日全天教育訓練未接觸用戶，無未成交案例' };
  assert.equal(check(report).ok, true);
});

test('zero service without explanation or with positive dialogue time is rejected', () => {
  const report = makeValidReport();
  report.contacts = [];
  Object.assign(report.today, { serviceCount: 0, billCount: 0, renewalCount: 0, earlyRenewalCount: 0, specialCount: 0, dealCount: 0, recognizedResult: '0筆' });
  const result = check(report);
  assert.ok(paths(result).includes('today.recognizedResult'));
  assert.ok(paths(result).includes('today.averageMinutes'));
});

test('first report may omit prior promises but must explain the initial report', () => {
  const report = makeValidReport();
  report.previous = { firstReport: true, reason: '今日首次列管，尚無前次承諾紀錄' };
  assert.equal(check(report).ok, true);
  report.previous.reason = '無';
  assert.ok(paths(check(report)).includes('previous.reason'));
});

test('no applicable case is allowed with an explanation', () => {
  const report = makeValidReport();
  report.case = { notApplicable: true, context: '今日提案用戶皆已成交，無未成交案例' };
  assert.equal(check(report).ok, true);
  report.case.context = '無適用案例';
  assert.ok(paths(check(report)).includes('case.context'));
});

test('numeric shortfall requires a real unfinished explanation and remedy deadline', () => {
  const report = makeValidReport(); report.previous.completedQty = 1;
  assert.equal(hasUnfinishedWork(report.previous), true);
  const result = check(report);
  for (const path of ['previous.unfinished', 'previous.reason', 'previous.remedy', 'previous.deadline']) assert.ok(paths(result).includes(path), path);
  Object.assign(report.previous, { unfinished: '尚有2位到期用戶未完成比較', reason: '2位用戶臨時改約，尚未回店', remedy: '重新致電確認可到店時段', deadline: '2026-10-22 16:00' });
  assert.equal(check(report).ok, true);
});

test('unknown, mismatched or inactive employees cannot submit', () => {
  for (const employee of [null, { employeeId: 'unknown' }, { employeeId: 'DEMO001', active: false }]) {
    const context = makeValidContext(); context.employee = employee;
    assert.ok(paths(validateReport(makeValidReport(), context)).includes('employeeId'));
  }
});

test('employee must belong to the supplied snapshot and snapshot id must match', () => {
  const context = makeValidContext(); context.snapshot.rows = [];
  assert.ok(paths(validateReport(makeValidReport(), context)).includes('employeeId'));
  const report = makeValidReport(); report.snapshotId = 'wrong';
  assert.ok(paths(check(report)).includes('snapshotId'));
});

test('invalid, future or pre-cutoff reporting dates are rejected', () => {
  for (const date of ['2026-02-30', '2026/10/21', '2026-10-22', '2026-10-19']) {
    const report = makeValidReport(); report.reportDate = date;
    assert.ok(paths(check(report)).includes('reportDate'), date);
  }
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2026-02-29'), false);
});

test('report date can be later than snapshot cutoff', () => {
  assert.equal(check(makeValidReport()).ok, true);
});

test('next shift and review date are ordered without forcing calendar-day attendance', () => {
  const report = makeValidReport(); report.tomorrow.date = '2026-10-25';
  assert.equal(check(report).ok, true);
  report.tomorrow.date = report.reportDate;
  assert.ok(paths(check(report)).includes('tomorrow.date'));
  report.meta.checkDate = '2026-10-20';
  assert.ok(paths(check(report)).includes('meta.checkDate'));
});

test('remaining workdays cannot exceed the available calendar interval', () => {
  const report = makeValidReport(); report.meta.remainingWorkdays = 5;
  assert.ok(paths(check(report)).includes('meta.remainingWorkdays'));
});

test('specific time windows and meaningful named shifts are accepted; impossible clock times are rejected', () => {
  const report = makeValidReport(); report.tomorrow.time = '下一出勤日早班';
  assert.equal(check(report).ok, true);
  report.tomorrow.time = '25:70';
  assert.ok(paths(check(report)).includes('tomorrow.time'));
});

test('overlong content is not truncated and returns a shortening request', () => {
  const report = makeValidReport();
  report.today.action = '確認上網需求與實際使用情況'.repeat(15);
  const original = report.today.action; const result = check(report);
  assert.ok(result.errors.some(issue => issue.path === 'today.action' && issue.message.includes('精簡')));
  assert.equal(report.today.action, original);
  assert.ok(original.length > FIELD_LIMITS['today.action']);
});

test('a report with individually valid but excessive total text is rejected', () => {
  const report = makeValidReport(); let serial = 1;
  for (const [path, limit] of Object.entries(FIELD_LIMITS)) {
    if (!/^(previous|today|case|tomorrow|learning)\./.test(path) || /\.(store|person|metric|priorityMetric|time|checkTime|deadline)$/.test(path)) continue;
    const [group, key, nested] = path.split('.');
    const content = `${serial++}先確認用戶目前月租及網路需求後比較方案並記錄同意回訪時段`;
    const text = (content + '；提供完整費用說明與使用情境比較').padEnd(limit - 1, '；');
    if (nested) report[group][key][nested] = text; else report[group][key] = text;
  }
  report.previous.unfinished = '已完成';
  const result = check(report);
  assert.ok(result.errors.some(issue => issue.path === 'report' && issue.message.includes(String(REPORT_TEXT_BUDGET.max))));
});

test('confirmation is required and manager-review injection is rejected', () => {
  const report = makeValidReport(); report.selfCheck = false;
  assert.ok(paths(check(report)).includes('selfCheck'));
  report.selfCheck = true; report.review = { approved: true };
  assert.ok(paths(check(report)).includes('review'));
});

test('question and learned technique cannot be the exact same pasted answer', () => {
  const report = makeValidReport(); report.learning.R1399.skill = report.learning.R1399.question;
  assert.ok(paths(check(report)).includes('learning.R1399.skill'));
});

test('only real snapshot metric keys or unambiguous display labels are accepted', () => {
  const context = makeValidContext();
  const report = makeValidReport();
  report.today.priorityMetric = 'A999'; report.tomorrow.metric = '寬頻';
  assert.equal(validateReport(report, context).ok, true);
  assert.equal(resolveSnapshotMetric('寬頻', context.snapshot).key, 'broadband');
  report.today.priorityMetric = 'A999_extra'; report.tomorrow.metric = '任意亂填的KPI';
  const result = validateReport(report, context);
  assert.ok(paths(result).includes('today.priorityMetric'));
  assert.ok(paths(result).includes('tomorrow.metric'));
});

test('missing metric definitions and ambiguous labels do not silently bypass matching', () => {
  const context = makeValidContext(); context.snapshot.metricDefinitions = [];
  assert.ok(paths(validateReport(makeValidReport(), context)).includes('today.priorityMetric'));
  context.snapshot.metricDefinitions = [{ key: 'bb1', label: '寬頻' }, { key: 'bb2', label: '寬頻' }];
  assert.equal(resolveSnapshotMetric('寬頻', context.snapshot), null);
  assert.equal(resolveSnapshotMetric('bb1', context.snapshot).key, 'bb1');
});

test('metric matching never includes object prototype properties', () => {
  const report = makeValidReport(); report.today.priorityMetric = '__proto__';
  report.tomorrow.metric = 'constructor';
  const result = check(report);
  assert.ok(paths(result).includes('today.priorityMetric'));
  assert.ok(paths(result).includes('tomorrow.metric'));
});

test('reasonable completed-work wording does not require an invented remedy', () => {
  for (const finished of ['完成', '無未完成項目', '已完成，無待補事項']) {
    const report = makeValidReport(); report.previous.unfinished = finished;
    assert.equal(hasUnfinishedWork(report.previous), false, finished);
    assert.equal(check(report).ok, true, finished);
  }
});

test('masked identifiers are optional and allow the agreed phone format only', () => {
  for (const value of ['', '0958***896', '0900***000']) assert.equal(isValidMaskedPhone(value), true, value);
  for (const value of ['0900000000', '0958**896', '0958****896', '09** ***896', '0958***89', 958896]) assert.equal(isValidMaskedPhone(value), false, String(value));
  for (const value of ['', '陳○○', '林*', '歐陽**', '司馬○○']) assert.equal(isValidMaskedName(value), true, value);
  for (const value of ['陳小明', '陳小○', '王明*', '陳', 'John**']) assert.equal(isValidMaskedName(value), false, value);
  const report = makeValidReport();
  report.contacts.forEach(row => { delete row.maskedName; delete row.phoneMasked; });
  assert.equal(check(report).ok, true);
});

test('complete or incorrectly masked customer identifiers fail at the precise row field', () => {
  const report = makeValidReport();
  report.contacts[0].phoneMasked = '0900000000'; report.contacts[1].maskedName = '陳小明';
  const result = check(report);
  assert.ok(paths(result).includes('contacts.0.phoneMasked'));
  assert.ok(paths(result).includes('contacts.1.maskedName'));
  assert.ok(result.errors.find(error => error.path === 'contacts.0.phoneMasked').message.includes('隱碼'));
  assert.equal(JSON.stringify(result).includes('0900000000'), false);
});

test('every summary count and rounded average must match the contact rows', () => {
  for (const key of ['serviceCount', 'billCount', 'renewalCount', 'earlyRenewalCount', 'specialCount', 'dealCount', 'averageMinutes']) {
    const report = makeValidReport(); report.today[key]++;
    assert.ok(paths(check(report)).includes(`today.${key}`), key);
  }
  assert.deepEqual(calculateContactSummary(makeValidReport().contacts), { serviceCount: 8, billCount: 5, renewalCount: 4, earlyRenewalCount: 2, specialCount: 1, dealCount: 1, averageMinutes: 6 });
});

test('missing, malformed and repeated contact codes are rejected without echoing identifiers', () => {
  for (const code of ['', {}, 'C 01', '0900000000', 'A123456789']) {
    const report = makeValidReport(); report.contacts[0].code = code;
    assert.ok(paths(check(report)).includes('contacts.0.code'), String(code));
  }
  const report = makeValidReport(); report.contacts[1].code = 'c01';
  assert.ok(paths(check(report)).includes('contacts.1.code'));
});

test('contacts must be an array of full records with at least one known, nonrepeated category', () => {
  for (const contacts of [undefined, {}, 'C01', [null], [[]], new Array(1)]) {
    const report = makeValidReport(); report.contacts = contacts;
    assert.equal(check(report).ok, false);
  }
  for (const categories of [[], ['unknown'], ['bill', 'bill'], [null], 'bill', ['constructor']]) {
    const report = makeValidReport(); report.contacts[0].categories = categories;
    assert.ok(paths(check(report)).includes('contacts.0.categories'));
  }
  const report = makeValidReport(); report.contacts[0].outcome = 'approved';
  assert.ok(paths(check(report)).includes('contacts.0.outcome'));
});

test('contact minutes use real nonnegative finite numbers, and one-decimal means can round to zero', () => {
  for (const minutes of ['', -1, Infinity, NaN, {}, '1 minute', 1441]) {
    const report = makeValidReport(); report.contacts[0].minutes = minutes;
    assert.ok(paths(check(report)).includes('contacts.0.minutes'), String(minutes));
  }
  const report = makeValidReport(); report.contacts.forEach(row => { row.minutes = 0.01; });
  Object.assign(report.today, calculateContactSummary(report.contacts));
  assert.equal(report.today.averageMinutes, 0); assert.equal(check(report).ok, true);
  report.contacts.forEach(row => { row.minutes = 0; });
  assert.equal(check(report).ok, true);
  assert.ok(check(report).warnings.some(issue => issue.path === 'today.averageMinutes'));
});

test('pure service and concrete no-followup reasons do not force a sale', () => {
  const report = makeValidReport(); report.contacts = [report.contacts[4]];
  Object.assign(report.today, calculateContactSummary(report.contacts));
  report.today.recognizedResult = '完成帳單繳費與收據說明，今日無成交';
  assert.equal(check(report).ok, true);
  report.contacts[0].followup = '無需追蹤';
  assert.ok(paths(check(report)).includes('contacts.0.followup'));
});

test('contact narratives reject emptiness and cross-field pasted boilerplate, not a shared opening script', () => {
  const report = makeValidReport(); report.contacts[0].need = '無需求';
  assert.ok(paths(check(report)).includes('contacts.0.need'));
  const repeated = '先了解需求再介紹合適方案並約定時間追蹤';
  for (const key of ['icebreaker', 'need', 'proposal', 'result']) report.contacts[0][key] = repeated;
  assert.ok(paths(check(report)).includes('contacts.0.proposal'));
  assert.equal(check(makeValidReport()).ok, true);
});

test('contact details have their own limits and do not consume the summary text budget', () => {
  const report = makeValidReport(); const template = report.contacts[0];
  report.contacts = Array.from({ length: MAX_CONTACTS }, (_, index) => ({ ...template, code: `C${String(index + 1).padStart(3, '0')}`, categories: [...template.categories] }));
  Object.assign(report.today, calculateContactSummary(report.contacts));
  assert.equal(check(report).ok, true);
  assert.ok(JSON.stringify(report.contacts).length > REPORT_TEXT_BUDGET.max);
  report.contacts.push({ ...template, code: 'C101' });
  assert.ok(paths(check(report)).includes('contacts'));
  report.contacts = [template]; Object.assign(report.today, calculateContactSummary(report.contacts));
  report.contacts[0].proposal = '確認用戶需求並說明費用差異'.repeat(20);
  const original = report.contacts[0].proposal;
  assert.ok(original.length > CONTACT_FIELD_LIMITS.proposal);
  assert.ok(paths(check(report)).includes('contacts.0.proposal'));
  assert.equal(report.contacts[0].proposal, original);
});

test('recognizable complete Taiwan mobiles, IDs and emails are blocked in all narrative sections', () => {
  const examples = [
    ['mobile', '0900000000'], ['mobile', '0900-000-000'], ['mobile', '+886 900 000 000'],
    ['mobile', '０９００００００００'], ['identity', 'A123456789'], ['email', 'demo@example.invalid'],
  ];
  for (const [type, value] of examples) {
    const text = `請聯繫${value}確認方案`;
    assert.equal(containsSensitiveData(text), true, value);
    assert.ok(findPrivacyIssue(text));
    assert.equal(findPersonalData(text)[0].type, type);
    const report = makeValidReport(); report.contacts[0].need = text;
    assert.ok(paths(check(report)).includes('contacts.0.need'));
    report.contacts[0].need = '確認目前方案與用量是否合適'; report.today.action = text;
    assert.ok(paths(check(report)).includes('today.action'));
    report.today.action = '確認目前方案與用量是否合適'; report.previous.reason = text;
    assert.ok(paths(check(report)).includes('previous.reason'), 'inactive optional narrative still checked');
    assert.equal(JSON.stringify(findPersonalData(text)).includes(value), false);
  }
});

test('privacy helpers do not mistake dates, ordinary employee codes, amounts or masked identifiers for full contact details', () => {
  for (const text of ['2026-10-21 09:58', '員編DEMO001及1234567', '月租999元，1399元，全年12000元', '陳○○ 0958***896', '帳號de***@example.invalid']) {
    assert.equal(containsSensitiveData(text), false, text);
    assert.equal(findPrivacyIssue(text), null, text);
  }
});

test('recursive privacy helper reports safe field paths and does not invoke getters or follow cycles', () => {
  const data = { contacts: [{ need: '請聯繫demo@example.invalid確認需求' }] }; data.self = data;
  let invoked = false;
  Object.defineProperty(data, 'secretGetter', { enumerable: true, get() { invoked = true; throw new Error('must not read'); } });
  const issues = findPersonalData(data);
  assert.equal(invoked, false); assert.equal(issues.length, 1);
  assert.equal(issues[0].path, 'contacts.0.need');
  assert.equal(JSON.stringify(issues).includes('demo@example.invalid'), false);
});



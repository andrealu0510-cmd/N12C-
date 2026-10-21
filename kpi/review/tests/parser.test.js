// Entirely synthetic fixtures. Run with: node tests/parser.test.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleText = await readFile(new URL('../parser.js', import.meta.url), 'utf8');
const { inspectWorkbook, parseSheet, normalizeRows } = await import(`data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`);
const xlsxText = await readFile(new URL('../vendor/xlsx.full.min.js', import.meta.url), 'utf8');
const XLSX = (await import(`data:text/javascript;base64,${Buffer.from(`${xlsxText}\nexport default XLSX;`).toString('base64')}`)).default;
const colName = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const pct = n => ({ t: 'n', v: n, w: `${n * 100}%`, z: '0.0%' });
function workbook(rows, merges = []) {
  const ws = { '!ref': `A1:${colName(Math.max(...rows.map(r => r.length)) - 1)}${rows.length}`, '!merges': merges };
  rows.forEach((row, r) => row.forEach((value, c) => {
    if (value !== '' && value != null) ws[`${colName(c)}${r + 1}`] = typeof value === 'object' ? value : { t: typeof value === 'number' ? 'n' : 's', v: value };
  }));
  return { SheetNames: ['測試資料'], Sheets: { 測試資料: ws } };
}
const header = ['門市', '員編', '姓名', '職稱', '排名', '總進度達成率', 'AQ V+D 999 (含)以上', '', '', '', 'RT V+D 999 (含)以上', '', '', '好速案銷售點數', '', '', '配件及其他營收', '', '新服務銷售數', '', '', 'RT V+D 1399 (含)以上', '', '包膜與保貼營收', ''];
const children = ['', '', '', '', '', '', '實績', '月目標', '進度達成率', '權重', '實績', '月目標', '進度達成率', '實績', '月目標', '進度達成率', '實績', '月目標', '實績', '月目標', '達成率', '實績', '月目標', '實績', '月目標'];
const person = ['示範門市甲', 'DEMO001', '測試甲', '業務代表', 5, pct(0.72), 8, 12, pct(0.8), 10, 17, 24, pct(0.91), 3.75, 7.5, pct(0.6), 2500, 6000, 2, 5, '40%', 6, 10, 900, 2000];
const rows = [['202610'], ['統計區間', '2026/10/01 ~ 10/21'], header, children, person];
const merges = [
  ...[0, 1, 2, 3, 4, 5].map(c => ({ s: { r: 2, c }, e: { r: 3, c } })),
  ...[[6, 9], [10, 12], [13, 15], [16, 17], [18, 20], [21, 22], [23, 24]].map(([s, e]) => ({ s: { r: 2, c: s }, e: { r: 2, c: e } }))
];

let completed = 0;
function test(name, fn) { fn(); completed++; process.stdout.write(`PASS ${name}\n`); }

test('merged multi-row headings map groups by labels; weights never become gaps', () => {
  const r = parseSheet(workbook(rows, merges), '測試資料');
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.rows.length, 1);
  assert.equal(r.header.dataStartRow, 4);
  assert.equal(r.rows[0].metrics.a999.actual, 8);
  assert.equal(r.rows[0].metrics.a999.target, 12);
  assert.equal(r.rows[0].metrics.a999.gap, null);
  assert.equal(r.mapping.metrics.a999.gap, null);
  assert.equal(r.rows[0].metrics.r999.actual, 17);
  assert.equal(r.rows[0].metrics.r1399.actual, 6);
  assert.equal(r.rows[0].metrics.broadband.unit, '點');
  assert.equal(r.rows[0].metrics.accessories.unit, '元');
  assert.equal(r.rows[0].metrics.film.actual, 900);
  const custom = r.metricDefinitions.find(m => m.sourceLabel === '新服務銷售數');
  assert.ok(custom?.key.startsWith('metric_'));
  assert.equal(r.rows[0].metrics[custom.key].achievement, 40);
});

test('numeric percentage formatting and literal percent text both normalize correctly', () => {
  const r = parseSheet(workbook(rows, merges), '測試資料');
  assert.equal(r.rows[0].overallProgress, 72);
  assert.equal(r.rows[0].metrics.a999.progress, 80);
  assert.equal(r.rows[0].metrics.a999.raw.progress.value, 0.8);
  assert.equal(r.rows[0].metrics.a999.raw.progress.format, '0.0%');
  const n = normalizeRows([{ employeeId: 'DEMO002', name: '測試乙', store: '示範店', overallProgress: '2%', metrics: { a999: { progress: pct(0.02) } } }]);
  assert.equal(n.rows[0].overallProgress, 2);
  assert.equal(n.rows[0].metrics.a999.progress, 2);
});

test('unformatted small percent numbers require explicit scale; values are preserved', () => {
  const n = normalizeRows([{ employeeId: 'DEMO003', name: '測試丙', store: '示範店', overallProgress: 0.8 }]);
  assert.equal(n.rows[0].overallProgress, null);
  assert.equal(n.rows[0].raw.overallProgress, 0.8);
  assert.ok(n.warnings.some(w => w.code === 'AMBIGUOUS_PERCENT'));
  const ratio = normalizeRows([{ employeeId: 'DEMO003', name: '測試丙', store: '示範店', overallProgress: 0.8 }], { percentScale: 'ratio' });
  assert.equal(ratio.rows[0].overallProgress, 80);
});

test('report cutoff is October 21; month has 31 days, never the upload date', () => {
  const r = parseSheet(workbook(rows, merges), '測試資料');
  assert.equal(r.detectedDate, '2026-10-21');
  assert.equal(r.dateInfo.daysInMonth, 31);
  assert.equal(r.dateInfo.elapsedDays, 21);
  assert.equal(r.dateInfo.calendarProgress, 21 / 31 * 100);
  const dateRows = [['資料截止日', '115年10月21日'], ['門市', '員編', '姓名', '總進度達成率'], ['示範店', 'DEMO004', '測試丁', '81%']];
  assert.equal(parseSheet(workbook(dateRows), '測試資料').detectedDate, '2026-10-21');
  dateRows[0][1] = '2026/02/31';
  assert.equal(parseSheet(workbook(dateRows), '測試資料').detectedDate, null);
  assert.equal(parseSheet(workbook(dateRows), '測試資料', { confirmedDate: '2026-10-21' }).detectedDate, '2026-10-21');
});

test('missing employee column is reported and cannot silently map by offset', () => {
  const r = parseSheet(workbook([['門市', '姓名', '總進度達成率'], ['示範店', '測試戊', '80%']]), '測試資料');
  assert.equal(r.ok, false);
  assert.equal(r.rows.length, 0);
  assert.ok(r.errors.some(e => e.code === 'MISSING_COLUMN' && e.field === 'employeeId'));
});

test('duplicate employees are deduplicated only when identical; conflicting rows block that employee', () => {
  const base = { employeeId: 'DEMO005', name: '測試己', store: '示範店', overallProgress: '70%', metrics: { a999: { actual: 3, target: 5 } } };
  const identical = normalizeRows([{ ...base, sourceRow: 5 }, { ...base, sourceRow: 6 }]);
  assert.equal(identical.rows.length, 1);
  assert.ok(identical.warnings.some(w => w.code === 'DUPLICATE_IDENTICAL'));
  const conflict = normalizeRows([{ ...base, sourceRow: 5 }, { ...base, sourceRow: 6, overallProgress: '90%' }]);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.rows.length, 0);
  assert.ok(conflict.errors.some(e => e.code === 'DUPLICATE_CONFLICT'));
  const resolved = normalizeRows([base, { ...base, overallProgress: '90%' }], { duplicatePolicy: 'last' });
  assert.equal(resolved.rows[0].overallProgress, 90);
});

test('zero targets stay zero; no Infinity or invented achievement/gap is calculated', () => {
  const r = normalizeRows([{ employeeId: 'DEMO006', name: '測試庚', store: '示範店', metrics: { a999: { actual: 5, target: 0 } } }]);
  assert.equal(r.rows[0].metrics.a999.target, 0);
  assert.equal(r.rows[0].metrics.a999.achievement, null);
  assert.equal(r.rows[0].metrics.a999.gap, null);
  assert.ok(r.warnings.some(w => w.code === 'ZERO_TARGET'));
});

test('lost merges, configurable mapping, and selectable workbook candidates', () => {
  const r = parseSheet(workbook(rows), '測試資料');
  assert.equal(r.rows[0].metrics.a999.target, 12);
  assert.equal(r.rows[0].metrics.broadband.progress, 60);
  const mapped = parseSheet(workbook([['甲欄', '乙欄', '丙欄', '丁欄'], ['示範店', 'DEMO007', '測試辛', 0.8]]), '測試資料', {
    headerStartRow: 0, headerEndRow: 0, dataStartRow: 1,
    mapping: { store: 0, employeeId: 1, name: 2, overallProgress: { column: 3, scale: 'ratio' } }
  });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.rows[0].overallProgress, 80);
  const wb = workbook(rows, merges);
  wb.SheetNames.push('說明'); wb.Sheets['說明'] = workbook([['這是說明頁']]).Sheets['測試資料'];
  const inspection = inspectWorkbook(wb);
  assert.equal(inspection.recommendedSheet, '測試資料');
  assert.deepEqual(inspection.candidates, ['測試資料']);
});

test('all selectable KPI groups survive broad aliases; flat custom columns remain usable', () => {
  const wb = workbook([
    ['門市', '員編', '姓名', '總進度達成率', '寬頻銷售數實績', '寬頻銷售數目標', '好速案銷售點數實績', '好速案銷售點數目標', '自訂新品銷售數實績', '自訂新品銷售數目標'],
    ['示範店', 'DEMO008', '測試壬', '88%', 3, 6, 4.5, 8, 2, 4]
  ]);
  const r = parseSheet(wb, '測試資料');
  assert.equal(r.ok, true);
  assert.equal(r.metricDefinitions.length, 3);
  const count = r.metricDefinitions.find(m => m.sourceLabel.startsWith('寬頻銷售數'));
  const points = r.metricDefinitions.find(m => m.sourceLabel.startsWith('好速案銷售點數'));
  assert.notEqual(count.key, points.key);
  assert.equal(count.unit, '件');
  assert.equal(points.unit, '點');
  assert.equal(r.rows[0].metrics[points.key].actual, 4.5);
  assert.ok(r.metricDefinitions.some(m => m.key.startsWith('metric_')));
});

test('percentage-unit metrics normalize actual and target, and invalid mapping bounds are blocked', () => {
  const r = normalizeRows([{ employeeId: 'DEMO009', name: '測試癸', store: '示範店', metrics: { ratio: { unit: '%', actual: pct(0.4), target: pct(0.5) } } }]);
  assert.equal(r.rows[0].metrics.ratio.actual, 40);
  assert.equal(r.rows[0].metrics.ratio.target, 50);
  const invalid = parseSheet(workbook(rows, merges), '測試資料', { mapping: { employeeId: 9999 } });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some(e => e.code === 'COLUMN_OUT_OF_RANGE'));
});

// Public report captions only; every person, store, ID and number below is fake.
// This profile deliberately has NO identity headings in A:H, matching the
// reported export shape. The reference tiers after the 46 groups are not KPIs.
const profileCaptions = [
  '5G銷售數', 'HBO Max&Disney+&Prime Video銷售數', 'Netflix多享組銷售數', 'TTL AQ上線點數', 'TTL AQ上線數',
  '自退數', '解約後NP OUT', '解約後NP OUT(督導績)', 'DS-AQ NP', 'AQ V+D 999 (含)以上', 'AQ V+D 1399 (含)以上',
  '預付卡開卡面額', 'RT上線點數', 'RT上線數', '特殊維繫用戶續約數', '高高特維用戶續約數', 'RT V+D 999 (含)以上', 'RT V+D 1399 (含)以上',
  'Device專案銷售數', '重點Device銷售量', '好速案銷售點數', '換約淨新增金額', '空機、3C、物聯網及門市購營收', '配件及其他營收',
  '包膜與保貼營收', '手機保險服務點數', 'MyVideo&KKBOX', 'MyVideo', 'KKBOX', 'Apple&Google服務及雜誌週刊開通數',
  'RT升轉率升轉件數', 'RT升轉率上線件數', 'RT降轉率降轉件數', 'RT降轉率上線件數',
  'RT升轉率_上線件數(前約 V+D 1399以下)', 'RT降轉率_上線件數(前約 V+D 1399(含)以上)',
  'RT降轉率_降轉數(前約 V+D 1399(含)以上)', 'RT升轉率_升轉數(前約 V+D 1399以下)',
  'RT降轉率_上線件數(前約 V+D 1399以下)', 'RT降轉率_降轉數(前約 V+D 1399以下)',
  'RT升轉率(前約 V+D 1399以下)', 'RT降轉率(前約 V+D 1399以下)', 'RT降轉率(前約 V+D 1399(含)以上)',
  'RT升轉率', 'RT降轉率', 'TTL AQ上線數_加分項'
];
const referenceGroups = new Set([4, 8, 13, ...Array.from({ length: 10 }, (_, i) => 30 + i)]);
function profileFixture({ shiftedRows = 0, merged = true, wide = false } = {}) {
  const r = Array.from({ length: shiftedRows + 13 }, () => []), off = shiftedRows;
  r[off + 1][0] = '提醒：預付卡資料 D-2；高風險特維每月 3 日後才呈現。';
  r[off + 2][0] = '上線數 KPI 進度達成率';
  r[off + 4][0] = '202610'; r[off + 4][3] = '2026/10/01 ~ 10/20';
  r[off + 6][10] = '一般項目'; r[off + 6][170] = '加減分項目';
  r[off + 6][194] = 'CBG AQ上線點數參考件數'; r[off + 6][203] = 'RT上線點數參考件數';
  r[off + 7][8] = '排名'; r[off + 7][9] = '總進度\n達成率';
  const mergeList = [8, 9].map(c => ({ s: { r: off + 7, c }, e: { r: off + 8, c } }));
  profileCaptions.forEach((caption, group) => {
    const c = 10 + group * 4;
    r[off + 7][c] = caption;
    ['實際數', '目標數', '權重', '進度達成率'].forEach((s, i) => { r[off + 8][c + i] = s; });
    mergeList.push({ s: { r: off + 7, c }, e: { r: off + 7, c: c + 3 } });
  });
  for (let c = 194; c <= 213; c++) { r[off + 8][c] = c - 194; }
  for (let p = 0; p < 4; p++) {
    const row = r[off + 9 + p];
    ['假區', '測試區', `DEMO00${p % 2 + 1}`, `示範門市${p % 2 + 1}`, p === 0 ? '店長' : '業務代表', p === 1 ? '55U3002' : `DEMO00${p + 1}`, `假名${p + 1}`, 9999, 40 - p, pct(0.65 + p / 10)].forEach((v, c) => { row[c] = v; });
    profileCaptions.forEach((caption, group) => {
      const c = 10 + group * 4, actual = 2 + p + group % 5, target = 15 + group;
      row[c] = actual; row[c + 1] = target; row[c + 2] = 7;
      row[c + 3] = pct(Number((actual / target * 31 / 20).toFixed(5)));
      if (referenceGroups.has(group)) { row[c + 1] = ''; row[c + 2] = 0; row[c + 3] = ''; }
      if (group >= 40 && group < 45) { row[c + 1] = 40 + p; row[c + 3] = pct(Number((actual / (40 + p)).toFixed(5))); }
      if (group === 20) row[c + 3] = pct(0.946 + p * 0.01); // rounded broadband values do not reconcile
      if (group === 9 && p === 0) row[c + 3] = pct(2.5); // source cap must survive unchanged
    });
    for (let c = 194; c <= 213; c++) row[c] = p + c - 194;
  }
  if (wide) r[0][16342] = '';
  return workbook(r, merged ? mergeList : []);
}
function xlsxRoundTrip(wb, dense) {
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
  return XLSX.read(bytes, { type: 'array', dense, cellNF: true, cellText: true, cellDates: true });
}

test('actual XLSX sparse and dense cells recover verified missing identity headings without manual mapping', () => {
  for (const dense of [false, true]) {
    const wb = xlsxRoundTrip(profileFixture({ wide: true }), dense);
    const r = parseSheet(wb, '測試資料', {}, XLSX);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.rowCount, 4); assert.equal(r.metricDefinitions.length, 46);
    assert.equal(r.header.columns.length, 214); assert.equal(r.profile?.id, '01-01-05');
    assert.equal(r.detectedDate, '2026-10-20'); assert.equal(r.dateInfo.daysInMonth, 31);
    assert.equal(r.mapping.employeeId.column, 5); assert.equal(r.mapping.name.column, 6);
    assert.equal(r.mapping.store.column, 3); assert.equal(r.rows[0].rank, 40);
    assert.equal(r.rows[1].employeeId, '55U3002');
    assert.equal(r.rows[0].metrics.a999.progress, 250);
    assert.equal(r.rows[0].metrics.a999.raw.progress.value, 2.5);
    assert.equal(r.mapping.metrics.a999.gap, null);
    assert.equal(r.profile.basisEvidence.basis, 'month');
    assert.equal(r.profile.basisEvidence.sampleCount, 11);
    assert.equal(r.profile.basisEvidence.metricCount, 3);
    assert.ok(r.profile.notes[0].includes('D-2'));
    assert.equal(r.warnings.length, 0);
  }
});

test('actual BIFF8 XLS preserves the 214-column profile and original percentage values', () => {
  const wb = profileFixture(); // BIFF8 supports at most 256 columns; omit fake trailing blanks.
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'biff8' });
  const readBack = XLSX.read(bytes, { type: 'array', cellNF: true, cellText: true, dense: false });
  const r = parseSheet(readBack, '測試資料', {}, XLSX);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.rowCount, 4); assert.equal(r.metricDefinitions.length, 46);
  assert.equal(r.header.columns.length, 214); assert.equal(r.profile?.id, '01-01-05');
  assert.equal(r.detectedDate, '2026-10-20'); assert.equal(r.basisEvidence.basis, 'month');
  assert.equal(r.rows[1].employeeId, '55U3002');
  assert.equal(r.rows[0].metrics.a999.progress, 250);
  assert.equal(r.rows[0].metrics.a999.raw.progress.value, 2.5);
  assert.equal(r.metricDefinitions.filter(d => d.progressKind === 'ratio').length, 5);
  assert.equal(r.warnings.length, 0);
});

test('reference groups and ratio numerators remain distinct, selectable source items with safe flags', () => {
  const r = parseSheet(profileFixture({ merged: false }), '測試資料');
  assert.equal(r.metricDefinitions.length, 46);
  assert.equal(new Set(r.metricDefinitions.map(d => d.key)).size, 46);
  assert.equal(r.metricDefinitions.filter(d => !d.active).length, 13);
  assert.equal(r.metricDefinitions.filter(d => d.reminderEligible === false).length, 18);
  const ratios = r.metricDefinitions.filter(d => d.progressKind === 'ratio');
  assert.equal(ratios.length, 5);
  for (const d of ratios) {
    assert.equal(d.unit, '件'); assert.equal(d.calculation, 'source-only'); assert.equal(d.reminderEligible, false);
    assert.equal(r.rows[0].metrics[d.key].target, 40);
    assert.ok(r.rows[0].metrics[d.key].progress > 0);
  }
  const broadband = r.metricDefinitions.find(d => d.key === 'broadband');
  assert.equal(broadband.calculation, 'source-only'); assert.equal(broadband.reminderEligible, true);
  assert.equal(r.rows[0].metrics.broadband.progress, 94.6);
  assert.equal(r.metricDefinitions.find(d => d.sourceLabel === '自退數').calculation, 'source-only');
  assert.equal(r.metricDefinitions.find(d => d.sourceLabel === 'TTL AQ上線數_加分項').calculation, 'source-only');
  assert.equal(r.metricDefinitions.filter(d => /MyVideo|KKBOX/.test(d.sourceLabel)).length, 3);
  assert.equal(r.metricDefinitions.find(d => d.sourceLabel === '預付卡開卡面額').unit, '元');
  assert.equal(r.metricDefinitions.find(d => d.sourceLabel === '5G銷售數').unit, '件');
  assert.ok(!r.metricDefinitions.some(d => /參考件數$/.test(d.sourceLabel)));
});

test('profile requires structural and multiple-row evidence, and basis disagreement never guesses', () => {
  const mismatch = profileFixture();
  mismatch.Sheets['測試資料'].AX11 = pct(1.42); // A999 original progress conflicts with both supported bases
  const r = parseSheet(mismatch, '測試資料');
  assert.equal(r.ok, true); assert.equal(r.basisEvidence.basis, 'unknown');
  assert.ok(r.warnings.some(w => w.code === 'TARGET_BASIS_UNCONFIRMED'));
  assert.ok(r.metricDefinitions.every(d => d.calculation === 'source-only'));
  const falseSignature = profileFixture();
  falseSignature.Sheets['測試資料'].F10 = { t: 's', v: 'not a valid ID' };
  const invalid = parseSheet(falseSignature, '測試資料');
  assert.equal(invalid.profile, null); assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some(e => e.code === 'MISSING_COLUMN'));
  const missingDate = profileFixture(); delete missingDate.Sheets['測試資料'].D5;
  const undated = parseSheet(missingDate, '測試資料');
  assert.equal(undated.detectedDate, null); assert.equal(undated.basisEvidence.basis, 'unknown');
  assert.ok(undated.warnings.some(w => w.code === 'DATE_NOT_FOUND'));
});

test('deep headers, old dense arrays and current !data dense sheets do not depend on first 80 rows', () => {
  const wb = xlsxRoundTrip(profileFixture({ shiftedRows: 120 }), true);
  const r = parseSheet(wb, '測試資料');
  assert.equal(r.rowCount, 4); assert.equal(r.header.dataStartRow, 129); assert.equal(r.detectedDate, '2026-10-20');
  const original = wb.Sheets['測試資料'];
  const data = original['!data'] || original;
  wb.Sheets['測試資料'] = { '!data': data, '!ref': original['!ref'], '!merges': original['!merges'] };
  const modern = parseSheet(wb, '測試資料');
  assert.equal(modern.rowCount, 4); assert.equal(modern.metricDefinitions.length, 46);
});

test('deep generic merged groups and split identity aliases are recognized without a profile', () => {
  const deepRows = Array.from({ length: 132 }, () => []);
  deepRows[120] = ['資料截止日', '2026/10/21'];
  deepRows[121][5] = 'AQ V+D 999 (含)以上';
  deepRows[129] = ['人員編號', '人員姓名', '服務中心名稱', '名次', '總進度達成率'];
  deepRows[130] = ['', '', '', '', '', '實際數', '月目標', '權重', '進度達成率'];
  deepRows[131] = ['DEMO901', '測試甲', '示範門市', 7, pct(0.9), 6, 10, 5, pct(0.86)];
  const deepMerges = [{ s: { r: 121, c: 5 }, e: { r: 129, c: 8 } }, ...[0, 1, 2, 3, 4].map(c => ({ s: { r: 129, c }, e: { r: 130, c } }))];
  const r = parseSheet(xlsxRoundTrip(workbook(deepRows, deepMerges), false), '測試資料');
  assert.equal(r.ok, true, JSON.stringify(r.errors)); assert.equal(r.profile, null);
  assert.equal(r.rows[0].metrics.a999.target, 10); assert.equal(r.rows[0].metrics.a999.progress, 86);
  assert.equal(r.detectedDate, '2026-10-21');
  const split = parseSheet(workbook([['員工', '員工', '門市', '總進度達成率'], ['編號', '姓名', '名稱'], ['DEMO902', '測試乙', '示範門市', '83%']]), '測試資料');
  assert.equal(split.ok, true); assert.equal(split.rows[0].employeeId, 'DEMO902');
});

process.stdout.write(`\n${completed} synthetic fixture tests passed.\n`);

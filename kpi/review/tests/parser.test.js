// Entirely synthetic fixtures. Run with: node review-build/parser.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleText = await readFile(new URL('../parser.js', import.meta.url), 'utf8');
const { inspectWorkbook, parseSheet, normalizeRows } = await import(`data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`);
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

process.stdout.write(`\n${completed} synthetic fixture tests passed.\n`);

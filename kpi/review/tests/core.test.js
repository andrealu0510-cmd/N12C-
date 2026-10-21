import test from 'node:test';
import assert from 'node:assert/strict';
import {
  period, validDate, metricValue, needsReport, sortPeople, validateSnapshot,
} from '../core.js';

// All identities, stores, counts and rates in this file are synthetic.
const approximate = (actual, expected, message = '') => {
  assert.equal(typeof actual, 'number', message);
  assert.ok(Math.abs(actual - expected) < 1e-9, message || `${actual} should equal ${expected}`);
};
const definition = (extra = {}) => ({ key: 'a999', label: 'A999', unit: '件', targetBasis: 'monthly', ...extra });
const employee = (metric = {}, extra = {}) => ({
  employeeId: 'DEMO001', name: '測試同仁甲', store: '假資料一店', job: '業務代表',
  rank: 12, overallProgress: 75, overallAchievement: null,
  metrics: { a999: { actual: 14, target: 31, ...metric } }, ...extra,
});
const snapshot = (row = employee(), definitions = [definition()]) => ({
  cutoffDate: '2024-02-21', sourceName: '核心測試・全假資料',
  metricDefinitions: definitions, rows: [row], selectedMetricKeys: ['a999'], rule: 'overall_and_metric',
});
const reviewSnapshot = (definitions = [definition()]) => ({
  cutoffDate: '2026-10-21', metricDefinitions: definitions,
});
const assertRejected = (value, message) => {
  let result;
  assert.doesNotThrow(() => { result = validateSnapshot(value); }, message);
  assert.ok(Array.isArray(result) && result.length > 0, message);
};

test('October 21 uses exactly 21/31 and rejects invalid calendar dates', () => {
  assert.deepEqual(period('2026-10-21'), { year: 2026, month: 10, day: 21, days: 31, fraction: 21 / 31 });
  assert.equal(period('2026-10-32'), null);
  assert.equal(validDate('2026-10-21'), true);
  assert.equal(validDate('2026-10-32'), false);
  const result = metricValue(employee(), definition(), '2026-10-21');
  assert.equal(result.expected, 21);
  approximate(result.progress, 14 / 21 * 100);
  approximate(result.achievement, 14 / 31 * 100);
  assert.equal(result.gap, 7);
});

test('February uses 29 days in a leap year and 28 otherwise', () => {
  assert.equal(period('2024-02-21').days, 29);
  assert.equal(period('2024-02-21').fraction, 21 / 29);
  assert.equal(period('2024-02-29').fraction, 1);
  assert.equal(period('2025-02-21').days, 28);
  assert.equal(period('2025-02-29'), null);
  assert.equal(validDate('2100-02-29'), false);
  const result = metricValue(employee({ actual: 10, target: 29 }), definition(), '2024-02-21');
  assert.equal(result.expected, 21);
  approximate(result.progress, 10 / 21 * 100);
});

test('monthly/month targets are prorated while toDate targets are already due amounts', () => {
  for (const basis of ['monthly', 'month']) {
    const result = metricValue(employee({ actual: 7, target: 31 }), definition({ targetBasis: basis }), '2026-10-21');
    assert.equal(result.expected, 21);
    approximate(result.achievement, 7 / 31 * 100);
    approximate(result.progress, 7 / 21 * 100);
  }
  for (const basis of ['toDate', 'todate', 'to-date']) {
    const result = metricValue(employee({ actual: 7, target: 21 }), definition({ targetBasis: basis }), '2026-10-21');
    assert.equal(result.expected, 21);
    approximate(result.progress, 7 / 21 * 100);
    assert.equal(result.achievement, null, 'a due-to-date target does not establish a monthly achievement rate');
    assert.equal(result.gap, 14);
  }
});

test('original progress of 250 is preserved instead of recalculating above the report cap', () => {
  const row = employee({ actual: 100, target: 5, progress: 250, achievement: 250, gap: 999 });
  const before = JSON.stringify(row);
  const result = metricValue(row, definition(), '2026-10-21');
  assert.equal(result.progress, 250);
  assert.equal(result.achievement, 250);
  assert.equal(result.progressSource, '原報表');
  approximate(result.gap, 5 * 21 / 31 - 100, 'an unexplained original gap must not override the confirmed target calculation');
  assert.equal(JSON.stringify(row), before, 'source data must stay unchanged');
});

test('unknown target basis does not invent expected amount, achievement, progress or gap', () => {
  const result = metricValue(employee({ targetBasis: 'unknown' }), definition({ targetBasis: 'unknown' }), '2026-10-21');
  for (const field of ['expected', 'achievement', 'progress', 'gap']) assert.equal(result[field], null, field);
  const original = metricValue(employee({ targetBasis: 'unknown', progress: 72, achievement: 48 }), definition({ targetBasis: 'unknown' }), '2026-10-21');
  assert.equal(original.progress, 72);
  assert.equal(original.achievement, 48);
  assert.equal(original.expected, null);
  assert.equal(original.gap, null);
});

test('zero target is not applicable and does not create infinity or a reporting obligation', () => {
  const row = employee({ actual: 5, target: 0, progress: 250, achievement: 250 });
  const result = metricValue(row, definition(), '2026-10-21');
  assert.equal(result.active, false);
  assert.equal(result.progress, null);
  assert.equal(result.achievement, null);
  assert.equal(result.gap, null);
  assert.equal(needsReport(row, reviewSnapshot(), ['a999']), false);
});

test('percentage-unit KPIs compare directly with the target without day prorating', () => {
  const def = definition({ key: 'ratio_test', label: '測試搭售率', unit: '%' });
  const row = employee({}, { metrics: { ratio_test: { actual: 40, target: 50 } } });
  for (const date of ['2026-10-01', '2026-10-21', '2026-10-31']) {
    const result = metricValue(row, def, date);
    assert.equal(result.expected, 50);
    assert.equal(result.progress, 80);
    assert.equal(result.achievement, 80);
    assert.equal(result.gap, 10);
  }
  const result = metricValue(row, { ...def, targetBasis: 'toDate' }, '2026-10-21');
  assert.equal(result.expected, 50);
  assert.equal(result.progress, 80);
});

test('overall rule requires overall below 100 AND a selected KPI below 80, with strict boundaries', () => {
  const cases = [
    [99.99, 79.99, true], [100, 79.99, false], [101, 79, false],
    [99, 80, false], [99, 100, false], [null, 70, false], [70, null, false],
  ];
  for (const [overallProgress, progress, expected] of cases) {
    const row = employee({ actual: null, target: null, progress }, { overallProgress });
    assert.equal(needsReport(row, reviewSnapshot(), ['a999'], 'overall_and_metric'), expected, `overall=${overallProgress}, metric=${progress}`);
  }
  const row = employee({ progress: 70 });
  assert.equal(needsReport(row, reviewSnapshot(), [], 'overall_and_metric'), false);
  assert.equal(needsReport(row, reviewSnapshot(), ['unselected_metric'], 'overall_and_metric'), false);
});

test('metric rule uses progress below 100 AND monthly achievement below 80 on the same selected KPI', () => {
  const cases = [[99.99, 79.99, true], [100, 79.99, false], [99.99, 80, false], [null, 70, false], [70, null, false]];
  for (const [progress, achievement, expected] of cases) {
    const row = employee({ actual: null, target: null, progress, achievement });
    assert.equal(needsReport(row, reviewSnapshot(), ['a999'], 'metric_and_achievement'), expected, `progress=${progress}, achievement=${achievement}`);
  }
  const definitions = [definition(), definition({ key: 'new_metric', label: '自選測試項目' })];
  const row = employee({}, { metrics: { a999: { progress: 99, achievement: 81 }, new_metric: { progress: 101, achievement: 70 } } });
  assert.equal(needsReport(row, reviewSnapshot(definitions), ['a999', 'new_metric'], 'metric_and_achievement'), false, 'conditions on different KPIs cannot be combined');
  row.metrics.new_metric.progress = 99;
  assert.equal(needsReport(row, reviewSnapshot(definitions), ['new_metric'], 'metric_and_achievement'), true);
});

test('original rank sorting is numeric, missing ranks stay last, and source order is unchanged', () => {
  const ranks = [100, 3, null, 20];
  const rows = ranks.map((rank, i) => employee({}, { employeeId: `DEMO10${i}`, rank }));
  const originalIds = rows.map(r => r.employeeId);
  assert.deepEqual(sortPeople(rows, 'rank-asc', null, reviewSnapshot()).map(r => r.rank), [3, 20, 100, null]);
  assert.deepEqual(sortPeople(rows, 'rank-desc', null, reviewSnapshot()).map(r => r.rank), [100, 20, 3, null]);
  assert.deepEqual(rows.map(r => r.employeeId), originalIds);
  assert.deepEqual(rows.map(r => r.rank), ranks);
});

test('valid snapshot accepts fractional point values and nullable optional fields without mutation', () => {
  const def = definition({ key: 'broadband', label: '測試寬頻', unit: '點' });
  const row = employee({}, { rank: null, overallAchievement: null, metrics: { broadband: { actual: 3.75, target: 7.5, progress: null, achievement: null } } });
  const value = snapshot(row, [def]);
  const before = JSON.stringify(value);
  assert.deepEqual(validateSnapshot(value), []);
  assert.equal(JSON.stringify(value), before);
});

test('snapshot validator rejects null/non-object snapshots, invalid collection shapes and null employees without throwing', () => {
  for (const value of [undefined, null, '', 1, [], {}]) assertRejected(value, `root ${String(value)}`);
  for (const rows of [null, {}, [], [null], [4]]) assertRejected({ ...snapshot(), rows }, 'invalid rows');
  for (const metricDefinitions of [null, {}, [], [null], [4]]) assertRejected({ ...snapshot(), metricDefinitions }, 'invalid metricDefinitions');
  for (const metrics of [null, [], 8, 'text']) assertRejected(snapshot(employee({}, { metrics })), 'invalid metrics container');
});

test('snapshot validator rejects duplicate employee IDs', () => {
  const value = snapshot();
  value.rows.push(employee({}, { name: '測試同仁乙' }));
  assert.ok(validateSnapshot(value).some(message => message.includes('員編重複')));
});

test('snapshot validator rejects wrong identity, rank, percentage and KPI numeric types', () => {
  for (const employeeId of [42, '', 'has space', 'x']) assertRejected(snapshot(employee({}, { employeeId })), 'invalid employee ID');
  for (const rank of [0, -1, 1.5, '2', NaN, Infinity]) assertRejected(snapshot(employee({}, { rank })), `rank ${String(rank)}`);
  for (const overallProgress of [-1, '80', '80%', NaN, Infinity]) assertRejected(snapshot(employee({}, { overallProgress })), 'invalid overall progress');
  for (const field of ['actual', 'target', 'progress', 'achievement']) for (const bad of [-1, '8', NaN, Infinity]) {
    assertRejected(snapshot(employee({ [field]: bad })), `${field}=${String(bad)}`);
  }
  assertRejected(snapshot(employee({}, { store: ' ', name: '測試同仁甲' })), 'empty store');
  assertRejected(snapshot(employee({}, { name: null })), 'null name');
  assertRejected(snapshot(employee({}, { metrics: { a999: 50 } })), 'scalar metric record');
});

test('snapshot validator rejects duplicate or malformed metric definitions and unconfirmed units/bases', () => {
  assertRejected(snapshot(employee(), [definition(), definition({ label: '重複測試項目' })]), 'duplicate metric keys');
  const invalid = [
    { key: '' }, { key: 'a999.x' }, { key: 2 }, { label: '' }, { label: ' ' },
    { unit: '' }, { unit: '未確認' }, { unit: 5 },
    { targetBasis: 'unknown' }, { targetBasis: '' }, { targetBasis: 'weight' },
  ];
  for (const bad of invalid) assertRejected(snapshot(employee(), [definition(bad)]), JSON.stringify(bad));
});

test('snapshot validator rejects an unconfirmed per-person basis that would override a confirmed definition', () => {
  for (const targetBasis of ['unknown', 'weight', 123]) {
    const value = snapshot(employee({ targetBasis }));
    assertRejected(value, `per-person targetBasis=${targetBasis}`);
  }
});

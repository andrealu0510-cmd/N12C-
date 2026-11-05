const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: {} };
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '../personal-core.js'), 'utf8');
vm.runInContext(source, context);
const parse = sheets => context.window.NPersonal.parseWorkbook(sheets, { models: [] }, []);

test('sparse Excel rows do not crash either report classifier', () => {
  const row = [];
  row[4] = '202611';
  row[12] = '手機競賽';
  assert.doesNotThrow(() => parse([{ name: '上線數KPI_店點達成率_明細', rows: [row] }]));
  assert.doesNotThrow(() => parse([{ name: '手機競賽_個人達成率', rows: [row] }]));
});

test('sparse summary columns preserve their Excel positions and rank zero', () => {
  const header = [], record = [];
  header[10] = '實際總獎金';
  header[14] = '推估原始總獎金';
  header[18] = '排名';
  header[22] = '領獎與否';
  record[3] = '測試門市';
  record[4] = '測試職稱';
  record[5] = '123A456';
  record[6] = '測試同仁';
  record[10] = 0;
  record[14] = 1234;
  record[18] = 0;
  record[22] = 'N';
  const result = parse([{ name: '獎金表', rows: [header, record] }]);
  assert.equal(result.leaderboard.length, 1);
  assert.equal(result.leaderboard[0].employeeId, '123A456');
  assert.equal(result.leaderboard[0].actualBonus, 0);
  assert.equal(result.leaderboard[0].projectedBonus, 1234);
  assert.equal(result.leaderboard[0].rank, 0);
  assert.equal(result.leaderboard[0].eligible, 'N');
});

test('blank files remain rejected instead of becoming publishable', () => {
  const result = parse([{ name: 'blank', rows: [Array(20), []] }]);
  assert.equal(result.leaderboard.length, 0);
  assert.ok(result.errors.length > 0);
});

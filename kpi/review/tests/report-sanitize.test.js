import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReport } from '../report-sanitize.js';
import { validateReport } from '../validation.js';
import { makeValidContext, makeValidReport } from './validation-fixtures.js';

test('valid report remains valid after scalar normalization', () => {
  const raw = makeValidReport(); raw.today.serviceCount = '8'; raw.tomorrow.target = '1.5點';
  const clean = sanitizeReport(raw);
  assert.equal(clean.today.serviceCount, 8); assert.equal(clean.tomorrow.target, 1.5);
  assert.equal(validateReport(clean, makeValidContext()).ok, true);
});

test('unknown top-level and nested fields cannot reach persistence', () => {
  const raw = makeValidReport();
  raw.status = 'approved'; raw.revision = 999; raw.review = { approved: true };
  raw.snapshot = { id: 'forged' }; raw.today.metrics = { A999: { actual: 999 } };
  raw.meta.managerReview = { reviewedBy: 'another-person' };
  raw.learning.A999.extra = 'unrecognized';
  const clean = sanitizeReport(raw);
  for (const key of ['status', 'revision', 'review', 'snapshot']) assert.equal(Object.hasOwn(clean, key), false);
  assert.equal(Object.hasOwn(clean.today, 'metrics'), false);
  assert.equal(Object.hasOwn(clean.meta, 'managerReview'), false);
  assert.equal(Object.hasOwn(clean.learning.A999, 'extra'), false);
});

test('objects and arrays are never stringified into narrative fields', () => {
  const raw = makeValidReport(); raw.today.action = { text: 'arbitrary object' };
  raw.learning.A999.skill = ['array']; raw.meta.managerName = { name: 'test' };
  const clean = sanitizeReport(raw);
  assert.equal(Object.hasOwn(clean.today, 'action'), false);
  assert.equal(Object.hasOwn(clean.learning.A999, 'skill'), false);
  assert.equal(validateReport(clean, makeValidContext()).ok, false);
});

test('input is not mutated and narrative content is never truncated', () => {
  const raw = makeValidReport(); raw.today.action = '先確認用戶需求再說明方案差異'.repeat(20);
  const before = JSON.stringify(raw); const clean = sanitizeReport(raw);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(clean.today.action, raw.today.action);
  assert.equal(validateReport(clean, makeValidContext()).ok, false);
});

test('prototype properties and JSON prototype keys are not copied', () => {
  const raw = JSON.parse(JSON.stringify(makeValidReport()).replace('{', '{"__proto__":{"polluted":true},'));
  Object.setPrototypeOf(raw.meta, { injected: 'value' });
  const clean = sanitizeReport(raw);
  assert.equal(Object.hasOwn(clean, '__proto__'), false);
  assert.equal(Object.hasOwn(clean.meta, 'injected'), false);
  assert.equal({}.polluted, undefined);
});

test('accessors are not executed while selecting schema fields', () => {
  const raw = makeValidReport(); let invoked = false;
  Object.defineProperty(raw.today, 'action', { get() { invoked = true; throw new Error('must not run'); } });
  const clean = sanitizeReport(raw);
  assert.equal(invoked, false); assert.equal(Object.hasOwn(clean.today, 'action'), false);
});

test('empty, invalid, non-finite and fractional integer numbers are not coerced', () => {
  for (const value of ['', ' ', null, [], {}, true, NaN, Infinity, -1, '8x', 1.5]) {
    const raw = makeValidReport(); raw.today.serviceCount = value;
    assert.equal(Object.hasOwn(sanitizeReport(raw).today, 'serviceCount'), false, String(value));
  }
});

test('booleans stay boolean and are never inferred from strings', () => {
  const raw = makeValidReport(); raw.selfCheck = 'true'; raw.previous.firstReport = 'false';
  const clean = sanitizeReport(raw);
  assert.equal(Object.hasOwn(clean, 'selfCheck'), false);
  assert.equal(Object.hasOwn(clean.previous, 'firstReport'), false);
});

test('HTML-looking text remains text for the renderer to escape', () => {
  const raw = makeValidReport(); raw.today.action = '<img src=x onerror=alert(1)> 先確認需求';
  const clean = sanitizeReport(raw);
  assert.equal(clean.today.action, raw.today.action);
});

test('non-object reports are rejected rather than persisted', () => {
  for (const value of [null, undefined, [], 'text', 1]) assert.throws(() => sanitizeReport(value), TypeError);
});

test('contact arrays retain only known fields and normalize numeric minutes without mutating input', () => {
  const raw = makeValidReport(); raw.contacts[0].minutes = '6';
  raw.contacts[0].fullName = 'should not persist'; raw.contacts[0].phone = '0900000000';
  raw.contacts[0].approved = true; raw.contacts.extra = 'not a row';
  const before = JSON.stringify(raw); const clean = sanitizeReport(raw);
  assert.equal(clean.contacts[0].minutes, 6);
  assert.equal(clean.contacts[0].phoneMasked, '0958***896');
  for (const key of ['fullName', 'phone', 'approved']) assert.equal(Object.hasOwn(clean.contacts[0], key), false);
  assert.equal(Object.hasOwn(clean.contacts, 'extra'), false);
  assert.notEqual(clean.contacts, raw.contacts); assert.notEqual(clean.contacts[0].categories, raw.contacts[0].categories);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(validateReport(clean, makeValidContext()).ok, true);
});

test('contact array, category and row accessors are not executed', () => {
  const raw = makeValidReport(); let invoked = false;
  const getter = () => { invoked = true; throw new Error('must not run'); };
  Object.defineProperty(raw.contacts, '1', { get: getter });
  Object.defineProperty(raw.contacts[0], 'need', { get: getter });
  Object.defineProperty(raw.contacts[2].categories, '0', { get: getter });
  const clean = sanitizeReport(raw);
  assert.equal(invoked, false); assert.deepEqual(clean.contacts[1], {});
  assert.equal(Object.hasOwn(clean.contacts[0], 'need'), false);
  assert.equal(Object.hasOwn(clean.contacts[2], 'categories'), false);
  assert.equal(clean.contacts.length, raw.contacts.length);
  assert.equal(validateReport(clean, makeValidContext()).ok, false);
});

test('malformed contacts or categories are not removed or stringified into a valid report', () => {
  const raw = makeValidReport(); raw.contacts[1] = null; raw.contacts[2].categories = [{ arbitrary: 'bill' }];
  raw.contacts[3].result = { text: 'done' };
  const clean = sanitizeReport(raw);
  assert.equal(clean.contacts.length, 8); assert.deepEqual(clean.contacts[1], {});
  assert.equal(Object.hasOwn(clean.contacts[2], 'categories'), false);
  assert.equal(Object.hasOwn(clean.contacts[3], 'result'), false);
  assert.equal(validateReport(clean, makeValidContext()).ok, false);
});

test('inherited contact fields and prototype keys never reach persistence', () => {
  const raw = makeValidReport(); const row = raw.contacts[0];
  delete row.need; Object.setPrototypeOf(row, { need: 'inherited narrative', injected: true });
  Object.defineProperty(row, '__proto__', { value: { polluted: true }, enumerable: true });
  const clean = sanitizeReport(raw);
  for (const key of ['need', 'injected', '__proto__']) assert.equal(Object.hasOwn(clean.contacts[0], key), false);
  assert.equal({}.polluted, undefined);
});

test('sanitization never masks personal data or clips excessive contacts behind the user’s back', () => {
  const raw = makeValidReport(); raw.contacts[0].phoneMasked = '0900000000';
  raw.contacts = Array.from({ length: 101 }, (_, index) => ({ ...raw.contacts[0], code: `C${index + 1}` }));
  const clean = sanitizeReport(raw);
  assert.equal(clean.contacts.length, 101); assert.equal(clean.contacts[0].phoneMasked, '0900000000');
  assert.equal(validateReport(clean, makeValidContext()).ok, false);
});


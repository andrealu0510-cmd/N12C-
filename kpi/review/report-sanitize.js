import { REPORT_SCHEMA, CONTACT_SCHEMA } from './validation.js';

const plainRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const NUMERIC_TYPES = new Set(['integer', 'number', 'quantity']);

// Own data properties only. Inherited fields or accessors are never trusted/read.
function readDataProperty(value, path) {
  let cursor = value;
  for (const key of path.split('.')) {
    if (!plainRecord(cursor)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
    cursor = descriptor.value;
  }
  return cursor;
}

function numericValue(value, type) {
  let number;
  if (typeof value === 'number') number = value;
  else if (typeof value === 'string') {
    const expression = type === 'quantity' ? /^(\d+(?:\.\d+)?)\s*(?:筆|點|台|人|件|次|戶)?$/u : /^(\d+(?:\.\d+)?)$/u;
    const match = value.trim().match(expression);
    if (!match) return undefined;
    number = Number(match[1]);
  } else return undefined;
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) return undefined;
  if (type === 'integer' && !Number.isSafeInteger(number)) return undefined;
  return number;
}

function typedValue(value, spec) {
  if (spec.type === 'contactArray') return contactValues(value);
  if (spec.type === 'stringArray') {
    if (!Array.isArray(value)) return undefined;
    const result = [];
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'string') return undefined;
      result.push(descriptor.value);
    }
    return result;
  }
  if (NUMERIC_TYPES.has(spec.type)) return numericValue(value, spec.type);
  if (spec.type === 'boolean' || spec.type === 'confirmation') return typeof value === 'boolean' ? value : undefined;
  if (spec.type === 'id') {
    if (typeof value === 'string') return value.trim();
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : undefined;
  }
  return typeof value === 'string' ? value.trim() : undefined;
}

function contactValues(value) {
  if (!Array.isArray(value)) return undefined;
  const contacts = [];
  // Preserve row count (including malformed rows as empty records) so that a
  // second validation cannot silently turn an invalid contact into no service.
  // No slicing: over-limit arrays must be rejected, never silently shortened.
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    const row = descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
    const clean = {};
    if (plainRecord(row)) {
      for (const [key, spec] of Object.entries(CONTACT_SCHEMA)) {
        const selected = typedValue(readDataProperty(row, key), spec);
        if (selected !== undefined) clean[key] = selected;
      }
    }
    contacts.push(clean);
  }
  return contacts;
}

function assignPath(output, path, value) {
  const parts = path.split('.');
  let cursor = output;
  for (const key of parts.slice(0, -1)) {
    if (!Object.prototype.hasOwnProperty.call(cursor, key)) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts.at(-1)] = value;
}

/**
 * Create a new report containing only REPORT_SCHEMA fields, CONTACT_SCHEMA rows,
 * and compatible scalar values. Numeric strings are normalized to numbers, ID numbers to strings, and
 * outer whitespace is trimmed. Narrative text is never clipped or HTML-decoded.
 *
 * IMPORTANT: validate the original report first (including forbidden review
 * injection), then sanitize before persistence. This helper is an allowlist,
 * not authorization, content validation, or HTML escaping. If called on malformed
 * input, incompatible field values are omitted, so validate the result as well
 * when the input has not already passed validation.
 */
export function sanitizeReport(report) {
  if (!plainRecord(report)) throw new TypeError('Report must be a non-array object.');
  const output = {};
  for (const [path, spec] of Object.entries(REPORT_SCHEMA)) {
    const value = typedValue(readDataProperty(report, path), spec);
    if (value !== undefined) assignPath(output, path, value);
  }
  return output;
}


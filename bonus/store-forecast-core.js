/* Store-only scenario estimates. Pure functions; no credentials or data writes. */
(function (root) {
  'use strict';
  const CUTS = [50, 80, 100, 120, 200];
  const count = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000;
  const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  function dateParts(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const d = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
    return { day: d.getUTCDate(), period: value.slice(0, 7), days: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(), date: d };
  }
  function shiftDay(value, days) {
    const p = dateParts(value); if (!p) return '';
    p.date.setUTCDate(p.date.getUTCDate() + days); return p.date.toISOString().slice(0, 10);
  }
  function tier(actual, target, elapsed, days, prices) {
    if (!count(actual) || !count(target) || target === 0 || !Number.isInteger(elapsed) || elapsed < 1 || elapsed > days || !Array.isArray(prices) || prices.length !== 5 || !prices.every(amount)) return null;
    // Integer cross multiplication avoids rounding into/out of a tier boundary.
    let index = -1;
    CUTS.forEach((cut, i) => { if (actual * days * 100 >= target * elapsed * cut) index = i; });
    return { index, amount: index < 0 ? 0 : prices[index], rate: actual * days / (target * elapsed), label: index < 0 ? '未達50%' : index === 4 ? '≥200%' : CUTS[index] + '%～<' + CUTS[index + 1] + '%' };
  }
  function inputCount(value) {
    if (!['string', 'number'].includes(typeof value)) return null;
    if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value); return count(n) ? n : null;
  }
  function simulate(defs, state, storeId, inputs, today) {
    const baseDate = dateParts(state?.asOf), current = dateParts(today);
    const i = (defs?.stores || []).findIndex(s => s.id === storeId), errors = [];
    if (i < 0) errors.push('請先選擇值班門市。');
    if (!baseDate || !current || defs?.period !== state?.period || baseDate?.period !== state?.period || state?.period !== current?.period) errors.push('月份或報表日期不符，請更新當月03店點資料。');
    if (state?.asOf !== shiftDay(today, -1) || state?.rowDates?.[i] !== state?.asOf) errors.push('所選門市03報表必須截至昨日；舊資料不可當作明日推估。');
    const rows = (defs?.models || []).map((model, j) => {
      const n = state?.actual?.[i]?.[j], t = state?.targets?.[i]?.[j], reportedRate = state?.rates?.[i]?.[j];
      const reasons = [];
      if (!count(n)) reasons.push('缺有效上線實績');
      if (!count(t) || t === 0) reasons.push('缺有效月目標');
      if (state?.origins?.[i]?.[j] !== 'report') reasons.push('目標尚非正式報表值');
      const baseline = baseDate ? tier(n, t, baseDate.day, baseDate.days, model.manager) : null;
      if (!baseline) reasons.push('實績、目標或級距資料無法計算');
      // The original report stores projected rates rounded to 4 decimal places.
      if (!amount(reportedRate)) reasons.push('缺原表推估達成率，不能驗證公式');
      else if (baseline && Math.abs(reportedRate - baseline.rate) > 0.000051) reasons.push('原表推估率與日均公式不符，停止推估');
      const rawInput = inputs?.[model.id] || { added: 0, removed: 0 };
      const added = inputCount(rawInput.added), removed = inputCount(rawInput.removed);
      if (added === null || removed === null) reasons.push('新增／沖回請填0～100000整數，空白不當作0');
      const net = added !== null && removed !== null ? added - removed : null;
      const tomorrowActual = count(n) && net !== null ? n + net : null;
      if (tomorrowActual !== null && !count(tomorrowActual)) reasons.push('沖回不可超過累計加新增，累計不可為負或超過100000');
      const usable = !errors.length && !reasons.length;
      const noSales = usable ? tier(n, t, current.day, current.days, model.manager) : null;
      const forecast = usable ? tier(tomorrowActual, t, current.day, current.days, model.manager) : null;
      return { id: model.id, name: model.name, actual: n, target: t, reportedRate, added, removed, net, tomorrowActual, baseline, noSales, forecast, reasons, delta: forecast ? forecast.amount - baseline.amount : null, timeEffect: noSales ? noSales.amount - baseline.amount : null, inputEffect: forecast ? forecast.amount - noSales.amount : null };
    });
    if (!rows.length) errors.push('缺店獎競賽組設定。');
    const complete = !errors.length && rows.length > 0 && rows.every(r => r.forecast !== null);
    const baselineComplete = rows.length > 0 && rows.every(r => r.baseline && !r.reasons.some(s => !s.startsWith('新增／') && !s.startsWith('沖回')));
    const sum = key => rows.reduce((s, r) => s + r[key], 0);
    const baselineAmount = baselineComplete ? rows.reduce((s, r) => s + r.baseline.amount, 0) : null;
    const forecastAmount = complete ? rows.reduce((s, r) => s + r.forecast.amount, 0) : null;
    const sourceReport = state?.report?.[i];
    const report = i >= 0 && baseDate && sourceReport && sourceReport.asOf === state.asOf && state.rowDates?.[i] === state.asOf ? sourceReport : null;
    return { store: defs?.stores?.[i] || null, rows, errors: [...new Set(errors)], complete, baselineAmount, forecastAmount, delta: complete ? sum('delta') : null, timeEffect: complete ? sum('timeEffect') : null, inputEffect: complete ? sum('inputEffect') : null, added: complete ? sum('added') : null, removed: complete ? sum('removed') : null, net: complete ? sum('net') : null, baseDate: state?.asOf || '', inputDate: today, reportDate: shiftDay(today, 1), report, scopeCount: rows.length, elapsed: current?.day, days: current?.days };
  }
  const api = { simulate, tier, dateParts, shiftDay, inputCount };
  root.NStoreForecast = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

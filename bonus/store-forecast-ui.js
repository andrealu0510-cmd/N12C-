/* Local-only store scenarios, using the existing authenticated 03 payload. */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id), C = root.NStoreForecast;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => typeof v === 'number' && Number.isFinite(v) ? '$' + v.toLocaleString('zh-TW', {maximumFractionDigits: 2}) : '待資料';
  const signed = v => typeof v === 'number' ? (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v)) : '不計算';
  const pct = v => typeof v === 'number' && Number.isFinite(v) ? (v * 100).toFixed(2) + '%' : '—';
  const tone = v => v > 0 ? 'forecast-up' : v < 0 ? 'forecast-down' : 'forecast-flat';
  let context = null, fingerprint = '', drafts = {}, selected = '', notice = '';
  const todayTW = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  function render(data) {
    const next = JSON.stringify([todayTW(), data.defs, data.state]);
    const changed = next !== fingerprint;
    if (fingerprint && changed && Object.keys(drafts).length) notice = '資料基準或日期已更新，舊試算已清除，請重新輸入今日數量，避免重複加算。';
    if (changed) drafts = {};
    context = data; fingerprint = next;
    const selector = $('storeForecastStore');
    if (changed || !selector.options.length) {
      selector.innerHTML = '<option value="">請選擇值班門市</option>' + (data.defs?.stores || []).map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('');
      if ((data.defs?.stores || []).some(s => s.id === selected)) selector.value = selected; else selected = '';
      buildTable();
    }
    updateResults();
  }
  function buildTable() {
    const store = selected;
    $('storeForecastTable').innerHTML = !store ? '<p class="warning">選好門市後，填寫全店今天新增與沖回的有效上線台數。</p>' : '<table class="store-forecast-table"><thead><tr><th>競賽組</th><th>原實績／月目標</th><th>今日新增</th><th>今日沖回／退件</th><th>今日淨變動</th><th>原表推估率</th><th>明日推估率／級距</th><th>原單組級距推估</th><th>明日單組推估</th><th>增減</th></tr></thead><tbody>' + (context.defs?.models || []).map((m,j) => {
      const d = drafts[store]?.[m.id] || {added: 0, removed: 0};
      return '<tr><th scope="row">' + esc(m.name) + '</th><td id="sfBase' + j + '"></td>' + ['added','removed'].map(kind => '<td><input type="number" min="0" max="100000" step="1" inputmode="numeric" value="' + esc(d[kind]) + '" data-model="' + esc(m.id) + '" data-kind="' + kind + '" aria-label="' + esc(m.name) + (kind === 'added' ? '今日新增' : '今日沖回退件') + '"></td>').join('') + '<td id="sfNet' + j + '"></td><td id="sfRate' + j + '"></td><td id="sfNext' + j + '"></td><td id="sfOldAmount' + j + '"></td><td id="sfNewAmount' + j + '"></td><td id="sfDelta' + j + '"></td></tr>';
    }).join('') + '</tbody></table>';
    document.querySelectorAll('#storeForecastTable input').forEach(input => input.addEventListener('input', () => {
      drafts[selected] ??= {}; drafts[selected][input.dataset.model] ??= {added: 0, removed: 0};
      drafts[selected][input.dataset.model][input.dataset.kind] = input.value;
      updateResults();
    }));
  }
  function updateResults() {
    if (!context) return;
    // Recheck Taiwan date even while a tab remains open overnight.
    if (JSON.parse(fingerprint)[0] !== todayTW()) { render(context); return; }
    const result = C.simulate(context.defs, context.state, selected, drafts[selected], todayTW());
    const r = result, title = r.scopeCount + '組店長級距推估小計';
    $('storeForecastNotice').textContent = notice; $('storeForecastNotice').hidden = !notice;
    $('storeForecastBasis').textContent = '03資料截至 ' + (r.baseDate || '待資料') + '｜今天輸入 ' + r.inputDate + '｜明日 ' + r.reportDate + ' 報表情境（截至今天）｜共用版本 ' + context.revision;
    $('storeForecastSource').textContent = '來源：' + (context.state?.source?.file || '尚未上傳03店點Excel');
    $('storeForecastBadge').className = 'fresh ' + (r.complete ? 'good' : 'bad');
    $('storeForecastBadge').textContent = r.complete ? '可作情境推估・非實領' : selected ? '資料／輸入待確認' : '請選值班門市';
    const issues = [...r.errors, ...r.rows.flatMap(row => row.reasons.map(reason => row.name + '：' + reason))];
    $('storeForecastErrors').textContent = selected ? [...new Set(issues)].join('；') : '請選擇值班門市。';
    $('storeForecastErrors').hidden = !issues.length;
    $('storeForecastSummary').innerHTML = '<article><small>原03實際總獎金（原值）</small><b>' + money(r.report?.actualBonus) + '</b><small>不是明日實領保證</small></article><article><small>原03推估原始總獎金（原值）</small><b>' + money(r.report?.projectedBonus) + '</b><small>另有本工具未涵蓋的範圍或規則</small></article><article><small>原' + title + '</small><b>' + money(r.baselineAmount) + '</b><small>相同範圍比較，不與原表總額混算</small></article><article class="forecast-feature"><small>明日' + title + '</small><b>' + (r.complete ? money(r.forecastAmount) : '暫不計算') + '</b><small>尚非全部店獎或核發金額</small></article>';
    if (selected) r.rows.forEach((row,j) => {
      $('sfBase'+j).textContent = (row.actual ?? '缺值') + '／' + (row.target ?? '缺目標');
      $('sfNet'+j).textContent = row.net === null ? '待輸入' : (row.net > 0 ? '+' : '') + row.net;
      $('sfRate'+j).textContent = pct(row.reportedRate);
      $('sfNext'+j).textContent = row.forecast ? pct(row.forecast.rate) + '｜' + row.forecast.label : row.reasons.join('；') || '日期待確認';
      $('sfOldAmount'+j).textContent = row.baseline && !row.reasons.some(s => !s.startsWith('新增／') && !s.startsWith('沖回')) ? money(row.baseline.amount) : '待資料';
      $('sfNewAmount'+j).textContent = row.forecast ? money(row.forecast.amount) : '不計算';
      $('sfDelta'+j).textContent = signed(row.delta); $('sfDelta'+j).className = tone(row.delta);
      [...document.querySelectorAll('#storeForecastTable input')].filter(input => input.dataset.model === row.id).forEach(input => { input.disabled = r.errors.length > 0; input.setAttribute('aria-invalid', String(row.reasons.some(s => s.startsWith('新增／') || s.startsWith('沖回')))); });
    });
    $('storeForecastResult').innerHTML = r.complete ? '<div class="big">' + esc(r.store.name) + '｜同範圍明日增減 <span class="' + tone(r.delta) + '">' + signed(r.delta) + '</span></div><p>今天新增 ' + r.added + ' 台 − 沖回／退件 ' + r.removed + ' 台 ＝ 淨變動 ' + (r.net > 0 ? '+' : '') + r.net + ' 台。</p><p>若今天沒有變動，天數增加的影響：<b>' + signed(r.timeEffect) + '</b>；本次輸入相對「今日0台」的影響：<b>' + signed(r.inputEffect) + '</b>；合計增減 <b>' + signed(r.delta) + '</b>。</p><p>明日推估率＝（原累計＋今日淨變動）÷月目標×' + r.days + '÷' + r.elapsed + '，逐組查50／80／100／120／200%店長級距再加總。畫面百分比會四捨五入，查級距使用未四捨五入的值。</p>' : '<div class="big">' + (selected ? '暫不顯示明日小計' : '先選擇值班門市') + '</div><p>缺資料、公式不符或輸入不完整時，不把未知金額當成0元。</p>';
    $('clearStoreForecast').disabled = !selected;
  }
  function clear() {
    context = null; fingerprint = ''; drafts = {}; selected = ''; notice = '';
    for (const id of ['storeForecastTable','storeForecastSummary','storeForecastResult','storeForecastErrors','storeForecastSource','storeForecastBasis','storeForecastNotice']) $(id).textContent = '';
    $('storeForecastStore').innerHTML = ''; $('storeForecastBadge').textContent = '等待登入資料';
  }
  $('storeForecastStore').addEventListener('change', e => { selected = e.target.value; notice = ''; buildTable(); updateResults(); });
  $('clearStoreForecast').addEventListener('click', () => { delete drafts[selected]; notice = '已清除本店輸入，回到「今日新增0、沖回0」情境；推估仍可能因天數增加而下降。'; buildTable(); updateResults(); });
  root.NStoreForecastUI = {render, clear, refresh: updateResults};
})(window);

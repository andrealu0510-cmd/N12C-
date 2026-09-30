'use strict';
/* CAYA 6.3: hide only products explicitly labelled 舊機.
   This code contains no private prices. It is applied after the authenticated
   release has passed its checksum. Workbook bytes and promotion rules are kept. */
(() => {
  const VERSION = '6.3-hide-used';
  function installVisibility() {
    'use strict';
    const version = '6.3-hide-used';
    const metadata = new WeakMap();
    const marked = value => /[舊旧][機机]/.test(String(value ?? '').normalize('NFKC').replace(/[\s\u200b-\u200d\ufeff]/g, ''));
    const key = value => String(value ?? '').trim().toUpperCase();
    function filter(source) {
      if (metadata.has(source)) return source;
      if (!source || !Array.isArray(source.allProducts) || !Array.isArray(source.quotes) || !(source.products instanceof Map)) {
        throw Error('商品顯示規則未能套用，請重新載入；不會改用未篩選的資料。');
      }
      const excluded = new Set();
      const records = [...source.allProducts, ...source.master, ...source.op];
      for (const item of records) if (marked(item.name)) excluded.add(key(item.sku));
      for (const quote of source.quotes) {
        if (marked(quote.product?.name) || marked(quote.sourceModel)) excluded.add(key(quote.product?.sku));
      }
      const keep = item => !excluded.has(key(item.sku)) && !marked(item.name);
      const allProducts = source.allProducts.filter(keep);
      const master = source.master.filter(keep), op = source.op.filter(keep);
      const quotes = source.quotes.filter(q => keep(q.product) && !marked(q.sourceModel));
      const quoteBySKU = new Map(), quoteById = new Map();
      for (const q of quotes) {
        if (!quoteBySKU.has(q.product.sku)) quoteBySKU.set(q.product.sku, []);
        quoteBySKU.get(q.product.sku).push(q); quoteById.set(q.id, q);
      }
      const hiddenRows = new Set();
      for (const sheet of source.sheets) {
        if (sheet.headerRow < 0) continue;
        const header = (sheet.rows[sheet.headerRow] || []).map(v => String(v ?? '').trim());
        const codeCol = header.indexOf('代碼') >= 0 ? header.indexOf('代碼') : header.indexOf('料號/組合料號');
        const nameCol = header.indexOf('機型') >= 0 ? header.indexOf('機型') : header.indexOf('品名');
        if (nameCol < 0) continue;
        for (let r = sheet.headerRow + 1; r < sheet.rows.length; r++) {
          const row = sheet.rows[r] || [];
          if (marked(row[nameCol]) || (codeCol >= 0 && excluded.has(key(row[codeCol])))) hiddenRows.add(sheet.index + ':' + r);
        }
      }
      // Operational indexes are new collections; source rows and all retained
      // product/quote objects are unchanged. No age-based or price-based inference.
      const view = { ...source, allProducts, master, op, quotes, quoteBySKU, quoteById,
        products: new Map(allProducts.map(p => [p.sku, p])),
        markedCount: master.filter(p => p.change).length,
        visibility: Object.freeze({ version, rule: '商品名稱標示舊機者暫不顯示；舊換新優惠不變',
          sourceProducts: source.allProducts.length, displayedProducts: allProducts.length,
          hiddenProducts: source.allProducts.length - allProducts.length,
          hiddenMasterRows: source.master.length - master.length,
          hiddenQuotes: source.quotes.length - quotes.length,
          originalMasterRows: source.master.length, originalOpRows: source.op.length,
          originalNumericPrices: source.numericCount, sourceWorkbookUnchanged: true }) };
      metadata.set(view, { excluded, hiddenRows });
      return view;
    }
    function isExcludedRow(view, sheet, row) { return metadata.get(view)?.hiddenRows.has(sheet.index + ':' + row) || false; }
    function isExcludedSku(view, sku) { return metadata.get(view)?.excluded.has(key(sku)) || false; }
    function sync(view) {
      const info = view?.visibility;
      if (!info) return;
      const host = document.querySelector('.versionbar');
      if (!host) return;
      let badge = document.getElementById('cayaVisibilityStatus');
      if (!badge) { badge = document.createElement('span'); badge.id = 'cayaVisibilityStatus'; badge.className = 'badge'; host.append(badge); }
      badge.textContent = '舊機品項已隱藏';
      badge.title = '已隱藏 ' + info.hiddenProducts.toLocaleString('zh-TW') + ' 個舊機料號；原始 Excel、其餘價格與舊換新優惠均保留。';
      const stats = document.getElementById('stats');
      if (stats && !document.getElementById('cayaVisibilityNote')) {
        const note = document.createElement('p'); note.id = 'cayaVisibilityNote'; note.className = 'sub';
        stats.insertAdjacentElement('afterend', note);
      }
      const note = document.getElementById('cayaVisibilityNote');
      if (note) note.textContent = '顯示 ' + info.displayedProducts.toLocaleString('zh-TW') + ' 個料號；另有 ' + info.hiddenProducts.toLocaleString('zh-TW') + ' 個標示舊機的料號暫不顯示。原始頁籤統計及 Excel 原檔完整保留。';
      document.documentElement.dataset.cayaCatalog = version;
    }
    window.cayaProductVisibility = Object.freeze({ version, filter, marked, isExcludedRow, isExcludedSku, sync });
  }
  function replaceOnce(text, before, after) {
    if (text.split(after).length - 1 === 1) return text;
    const count = text.split(before).length - 1;
    if (count === 1) return text.replace(before, after);
    throw Error('工作台格式已變更，商品隱藏規則未套用；請先更新相容版本。');
  }
  function prepare(html) {
    if (typeof html !== 'string' || !html.includes('id="seed"') || !html.includes('id="promotionData"')) throw Error('不是完整的查價工作台。');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scripts = [...doc.querySelectorAll('script:not([src])')].filter(s => s.type !== 'application/json');
    const cores = scripts.filter(s => s.textContent.includes('async function parseWorkbook(bytes,name){'));
    if (cores.length !== 1) throw Error('未找到唯一的價格解析器，暫停載入以避免顯示未篩選商品。');
    const seedText = doc.getElementById('seed').textContent;
    const promoText = doc.getElementById('promotionData').textContent;
    const core = cores[0]; let code = core.textContent;
    code = replaceOnce(code, "progress('完成全頁籤檢核',100);return result;", "progress('完成全頁籤檢核',100);return window.cayaProductVisibility.filter(result);");
    code = replaceOnce(code, 'function hydrate(){', 'function hydrate(){window.cayaProductVisibility.sync(data);');
    code = replaceOnce(code,
      'if(!query||(s.rows[r]||[]).some(v=>norm(v).includes(query)))list.push(r);',
      'if(!window.cayaProductVisibility.isExcludedRow(data,s,r)&&(!query||(s.rows[r]||[]).some(v=>norm(v).includes(query))))list.push(r);');
    code = replaceOnce(code,
      "pager('rawFoot',list.length,rawPage,'raw');",
      "$('rawInfo').textContent+=' 商品名稱標示舊機者已隱藏，原始列號不重編，Excel原檔保留。';pager('rawFoot',list.length,rawPage,'raw');");
    code = replaceOnce(code, 'function plainAudit(){return{filename:data.name,', 'function plainAudit(){return{visibility:data.visibility,filename:data.name,');
    core.textContent = code;
    const chats = scripts.filter(s => s.textContent.includes('function buildAnswer(q){'));
    if (chats.length !== 1) throw Error('未找到唯一的 CAYA 查詢器，請更新相容版本。');
    chats[0].textContent = replaceOnce(chats[0].textContent, 'function buildAnswer(q){',
      "function buildAnswer(q){if(q.unknownSKU&&window.cayaProductVisibility.isExcludedSku(getData(),q.unknownSKU))return '<h3>此料號已從查詢移除。</h3><p>標示舊機的商品暫不提供查價；舊換新優惠仍可正常查詢。</p>';");
    doc.getElementById('cayaProductVisibilityRuntime')?.remove();
    const runtime = doc.createElement('script'); runtime.id = 'cayaProductVisibilityRuntime';
    runtime.textContent = '(' + installVisibility.toString() + ')();'; doc.head.prepend(runtime);
    if (seedText !== doc.getElementById('seed').textContent || promoText !== doc.getElementById('promotionData').textContent) throw Error('來源資料保留檢查失敗。');
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }
  window.cayaPrepareWorkspace = prepare;
  window.cayaCatalogPolicyVersion = VERSION;
})();

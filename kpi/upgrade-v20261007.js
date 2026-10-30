/* N12C daily-review patch. Application code only; no report rows or credentials. */
(function () {
  'use strict';
  const VERSION = '2026-10-30.4';
  const LOADER_VERSION = '2026-10-30.4';
  function upgradeHtml(input) {
    let html = String(input);
    const replaceOnce = (oldText, newText) => {
      if (!html.includes(oldText)) throw new Error('管理頁版本不符，已停止套用以避免錯算：' + oldText.slice(0, 36));
      html = html.replace(oldText, newText);
    };
    // The API's v15 template has six items and no <70% tier. Accept only
    // reviewed template variants; unknown schemas still fail closed.
    const replaceKnown = (label, variants, replacement) => {
      const matches = variants.filter(text => html.includes(text));
      if (matches.length !== 1 || html.split(matches[0]).length !== 2) {
        throw new Error('管理頁版本不符（' + label + '），已停止載入；報表未刪除。');
      }
      html = html.replace(matches[0], replacement);
    };
    const finalItems = 'const ITEMS=["VK","Apple服務","影音(HBO/D+/Prime)","Netflix","配件","包膜","保險搭售"];';
    const finalScore = score.toString();
    replaceKnown('附掛欄位', [
      'const ITEMS=["影音(HBO/D+/Prime)","Netflix","配件","包膜","保險","VK","天下/開通"];',
      'const ITEMS=["影音(HBO/D+/Prime)","Netflix","配件","包膜","VK","天下/開通"];',
      'const ITEMS=["配件","包膜","VK","天下/開通"];',
      finalItems
    ], finalItems);
    replaceKnown('計分函式', [
      'function score(v){if(v==null)return 0;if(v<70)return-.2;if(v<100)return-.1;if(v>110)return .1;return 0;}',
      'function score(v){if(v==null)return 0;if(v<100)return-.1;if(v>110)return .1;return 0;}',
      'function score(v){if(v==null||!Number.isFinite(Number(v)))return null;if(v<100)return-.1;if(v>110)return .1;return 0;}',
      finalScore
    ], finalScore);
    replaceOnce('function extractPeople(rows){', 'function n12cLegacyExtractPeople(rows){');
    replaceOnce('function extractStores(rows){', 'function n12cLegacyExtractStores(rows){');
    html = html.replaceAll('附掛6項：影音｜Netflix｜配件｜包膜｜VK｜天下/開通', '一條龍7項：V+K｜Apple服務／開通｜影音｜Netflix｜配件｜包膜｜保險搭售');
    html = html.replaceAll('附掛6項', '一條龍7項');
    html = html.replace('rank:rateN(r[6])', 'rank:n(r[6])');
    // This undefined variable used to abort the review when any roster member was missing.
    html = html.replaceAll('.map(rec=>({rec:x,ev:null,missing:true}))', '.map(rec=>({rec,ev:null,missing:true}))');
    html = html.replaceAll('9/28前請先確認名單', '請先確認本期名單');
    html = html.replaceAll('9/28', '每日');
    html = html.replaceAll('每日需上線檢閱EXCEL明細', '依目前載入報表檢閱');
    for (const old of ['規則：<70% -0.2｜<100% -0.1｜>110% +0.1', '規則：<100% -0.1｜100~110%(含) 0｜>110% +0.1']) {
      html = html.replaceAll(old, '規則：V+K／Apple<100% −0.1；影音／Netflix<70% −0.1；配件／包膜<50% −0.2、50%～未滿80% −0.1；>110% +0.1');
    }
    html = html.replace(/<div class="rules">[\s\S]*?<\/div>/, '<div class="rules"><strong>一條龍7項｜分項加減分規則（2026-10-30更新）</strong><div class="table-wrap"><table><thead><tr><th>項目</th><th>扣分門檻</th></tr></thead><tbody><tr><td>V+K（MyVideo&KKBOX）</td><td>未達100%：−0.1</td></tr><tr><td>Apple服務／開通</td><td>未達100%：−0.1</td></tr><tr><td>HBO Max＆Disney+＆Prime Video</td><td>未達70%：−0.1（合併一項）</td></tr><tr><td>Netflix多享組</td><td>未達70%：−0.1</td></tr><tr><td>配件及其他營收</td><td>低於50%：−0.2；50%～未滿80%：−0.1</td></tr><tr><td>包膜與保貼營收</td><td>低於50%：−0.2；50%～未滿80%：−0.1</td></tr><tr><td>保險搭售（010508／010509）</td><td>低於45%：−0.1；45%以上：0</td></tr></tbody><tfoot><tr class="n12c-rule-total"><th>SPE總計扣分（本表7項最重級距）</th><td><strong>−0.9 分</strong><br><small>0.1 × 5項 ＋ 0.2 × 2項＝0.9分</small></td></tr></tfoot></table></div>◆ 以上為每人7項均落在最重扣分級距、未套用店績豁免時的扣分上限；實際依達成率計算。<br>◆ 恰好達門檻不扣該級分數；同項扣分擇一、不累扣。前六項超過110%：<span class="good">+0.1</span>。<br>◆ 店績同項超過100%，個人扣分豁免；店長／代理店長只採店績。<br>◆ Apple服務／開通沿用「Apple&Google服務及雜誌週刊開通數」報表欄位（原標示天下／開通）；新版「Google服務及雜誌週刊開通數」沿用同一開通項，實際欄名列於資料連動狀態，不重複計分。<br>◆ 保險搭售採010508店績／010509個人成績，低於45%扣0.1，不套用店績豁免或加分；缺值顯示待補。QIS、舊機回收另由督導確認。<div class="n12c-deduction-banner" role="status" aria-live="polite"><span>全區人員 SPE總計扣分（含店長）</span><strong id="n12cDeductionSummary">待補資料</strong><small>計入店績豁免後的實際扣分，加分另列；資料未齊時只顯示完整人員暫算。</small></div></div>');
    html = html.replace('Y2609 管理辦法｜固定網頁版', '每日管理檢閱｜一條龍7項加減分');
    const syncUi = `<section class="panel" id="n12cSyncPanel"><div class="panel-title">資料連動狀態 <small>修正版 ${VERSION}</small></div><div id="n12cSourceStatus" class="copybox"></div><div class="controls" style="margin-top:10px"><button class="btn btn-blue" id="n12cRecalc">重新檢閱／計算總分</button><button class="btn btn-soft" id="n12cToUpload">前往資料上傳</button></div><details><summary>報表日期未辨識時，在此確認（不必重傳）</summary><div class="controls" style="margin-top:8px"><label>010103 資料截止日 <input type="date" id="n12cDate103"></label><label>010105 資料截止日 <input type="date" id="n12cDate105"></label><button class="btn btn-soft" id="n12cConfirmDates">確認資料日期</button></div><div class="note">此處是報表資料日，不是今天日期；兩份報表的截止日須一致才可確認結算。</div></details></section>`;
    replaceOnce('<section id="sheet-overview"', syncUi + '\n<section id="sheet-overview"');
    replaceOnce('<div class="tabs">', '<div class="tabs"><button class="tab" data-sheet="totals">SPE總分計算</button>');
    const totalsUi = `<section id="sheet-totals" class="sheet"><div class="panel"><div class="panel-title">一條龍7項｜SPE總分計算</div><div id="n12cTotalNotice" class="complete"></div><div class="summary" style="margin-top:10px"><div class="sum blue"><div class="n" id="n12cNet">—</div><div class="t">人員淨總分（含店長）</div></div><div class="sum green"><div class="n" id="n12cPlus">—</div><div class="t">單項加分合計</div></div><div class="sum red"><div class="n" id="n12cMinus">—</div><div class="t">SPE總計扣分</div></div><div class="sum"><div class="n" id="n12cReady">0</div><div class="t">資料完整人數</div></div><div class="sum red"><div class="n" id="n12cPending">0</div><div class="t">待補資料人數</div></div></div><div class="controls" style="margin-top:10px"><button class="btn btn-blue" id="n12cExport">匯出計分CSV</button><button class="btn btn-soft" id="n12cCopyTotals">複製總分摘要</button></div><div class="note">一般同仁以個人成績計算，店績同項＞100%免除該項個人扣分；個人＞110%仍保留加分。店長／代理店長只計一次店績，店績合計不再重複加進人員總分。保險搭售低於45%另扣0.1；保險金牌不列入SPE。</div></div><div class="panel"><div class="panel-title">各店人員合計</div><div class="table-wrap" id="n12cStoreTotals"></div></div><div class="panel"><div class="panel-title">每人七項計分明細</div><div class="table-wrap" id="n12cPersonTotals"></div></div></section>`;
    replaceOnce('<section id="sheet-store"', totalsUi + '\n<section id="sheet-store"');
    html = html.replace('</style>', '.n12c-rule-total th,.n12c-rule-total td{background:#fde9ec!important;color:#b00020!important;font-size:18px;font-weight:900}.n12c-rule-total strong{font-size:26px}.n12c-rule-total small{font-size:13px}.n12c-deduction-banner{display:flex;align-items:center;flex-wrap:wrap;gap:8px 20px;background:#fff0f1;border:2px solid #d7263d;border-radius:9px;padding:12px;margin-top:10px;color:#a5001b;font-weight:900}.n12c-deduction-banner strong{font-size:28px}.n12c-deduction-banner small{flex-basis:100%;font-size:13px;color:#6d7482;font-weight:500}.n12c-deduction-cell{color:#b00020;font-weight:900;white-space:nowrap}.mobile-score small{display:block;font-size:12px}#n12cSyncPanel small{font-size:13px;color:var(--muted)}#n12cSourceStatus{overflow-wrap:anywhere}#n12cPersonTotals table,#n12cStoreTotals table{font-size:17px}#n12cPersonTotals td small{font-size:12px}.bad1{background:var(--redsoft)!important;color:var(--red)!important;font-weight:900}.n12c-pending{color:#8a4b00;background:#fff4d8;font-weight:800}#n12cSyncPanel input{padding:7px;border:1px solid #bbc3d4;border-radius:7px}\n</style>');
    // All old listeners keep their functions, while every render uses the patched shared state.
    replaceOnce('function renderFilters(){', 'function renderFilters(){\n n12cRenderExtras();');
    const functions = [parseDelimited, n12cNormalize, n12cKpiSections, n12cMetricRate, n12cRateColumns, n12cReadMetrics, extractPeople, extractStores,
      n12cInsuranceParse, n12cInsuranceRate, n12cInsuranceRefresh, n12cSaveInsurance, applyRawFile, applyRawPaste,
      scoreTxt, metricClass, evalStore, evalPerson, metricTd,
      n12cDeduction, n12cDeductionText, n12cDeductionCell, n12cSummaryDeduction,
      n12cValidDate, n12cDetectPeriod, n12cSourceMeta, n12cPeriodReady, n12cUpdateMeta,
      n12cUploadStatus, applyFile, applyPaste, n12cScoreRows, n12cTotals,
      n12cTotalText, n12cExportCsv, n12cRenderExtras, n12cBootstrap];
    const source = '\nconst N12C_RULE_VERSION=' + JSON.stringify(VERSION) + ';\nconst n12cBusy={};const n12cUploadErrors={};\n' + functions.map(f => f.toString()).join('\n') + '\n';
    replaceOnce('function switchSheet(name)', source + '\nfunction switchSheet(name)');
    replaceOnce('restoreCurrent();\ndocument.getElementById("workDate").value=stateDateISO();', 'restoreCurrent();\nn12cBootstrap();\ndocument.getElementById("workDate").value=stateDateISO();');
    // Work date is only a filing date. It must not relabel a September report as October.
    html = html.replace('state.date=isoToday().replace(/-/g,"/");persistCurrent();render();', 'persistCurrent();render();');
    html = html.replace('state.date=e.target.value.replace(/-/g,"/");persistCurrent();render();', 'persistCurrent();render();');
    html = html.replace('state.date=date.replace(/-/g,"/");\n const h=readHistory();', 'const h=readHistory();');
    html = html.replace('const payload={version:6,exported_at:', 'const payload={version:18,rule_version:N12C_RULE_VERSION,exported_at:');
    html = html.replaceAll('esc(k.replace("影音(HBO/D+/Prime)","影音"))', 'esc(k.replace("影音(HBO/D+/Prime)","影音").replace("VK","V+K").replace("Apple服務","Apple服務／開通"))');
    // Keep deductions visible beside net SPE in the legacy store/person views.
    html = html.replaceAll('<th>SPE</th>', '<th>SPE總計扣分</th><th>SPE淨分</th>');
    replaceOnce('${ev.items.map(metricTd).join("")}<td class=', '${ev.items.map(metricTd).join("")}${n12cDeductionCell(ev)}<td class=');
    replaceOnce('${e.items.map(metricTd).join("")}<td class=', '${e.items.map(metricTd).join("")}${n12cDeductionCell(e)}<td class=');
    replaceOnce('${ITEMS.map(()=>"<td>未載入</td>").join("")}<td>—</td>', '${ITEMS.map(()=>"<td>未載入</td>").join("")}<td class="n12c-pending">待補資料</td><td>—</td>');
    replaceOnce('<div class="mobile-score">SPE ${scoreTxt(ev.total)}</div>', '<div class="mobile-score">SPE總計扣分 ${n12cDeductionText(n12cDeduction(ev))}<small>SPE淨分 ${scoreTxt(ev.total)}</small></div>');
    html = html.replaceAll('SPE ${scoreTxt(x.ev.total)}', 'SPE總計扣分 ${n12cDeductionText(n12cDeduction(x.ev))}｜SPE淨分 ${scoreTxt(x.ev.total)}');
    // The old reminder hard-coded -0.1 even when an item now deducts -0.2.
    html = html.replaceAll('${i.key} ${pct(i.rate)} (-0.1)', '${i.key} ${pct(i.rate)} (${scoreTxt(i.score)})');
    html=html.replaceAll('目前先保存原始表格，不做額外計算。','低於45%扣0.1，套用後立即連動SPE總分。');
    html=html.replace('<input id="upload103" type="file" accept=".xlsx,.xls">','<input id="upload103" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.md,.html,.xml"><textarea id="uploadPaste103" placeholder="也可從Excel複製完整表格（含表頭）貼在這裡"></textarea><div class="rowbtn"><button class="btn btn-blue" id="uploadApply103">套用貼上資料</button></div>');
    html=html.replaceAll('>儲存貼上資料</button>','>套用貼上資料並計算</button>');
    html=html.replace('保險／QIS／舊機回收</div>','QIS／舊機回收人工確認</div>');
    html=html.replace('<button class="btn btn-soft" id="n12cConfirmDates">','<label>010508 資料截止日 <input type="date" id="n12cDate508"></label><label>010509 資料截止日 <input type="date" id="n12cDate509"></label><button class="btn btn-soft" id="n12cConfirmDates">');
    html=html.replace('兩份報表的截止日須一致才可確認結算。','四份報表的截止日須一致才可確認結算。');
    html=html.replaceAll('保險搭售／QIS／舊機回收：目前由督導人工確認，不納入網頁自動計分。','保險搭售採010508／010509，低於45%扣0.1；QIS／舊機回收由督導人工確認。');
    html=html.replaceAll('※保險搭售／QIS／舊機回收由督導人工確認，暫不納入網頁計分。','※保險搭售已納入SPE；QIS／舊機回收由督導人工確認。');
    return html;
  }

  function scoreTxt(x) { if(x==null||!Number.isFinite(Number(x)))return '待補'; x=clean(x); return x>0?'+'+x.toFixed(1):x.toFixed(1); }
  function score(v, key) {
    if (v == null || String(v).trim() === '' || !Number.isFinite(Number(v))) return null;
    v = Number(v);
    if (!ITEMS.includes(key)) return null;
    if (key === '保險搭售') return v < 45 ? -0.1 : 0;
    if ((key === '配件' || key === '包膜') && v < 50) return -0.2;
    const minimum = key === '影音(HBO/D+/Prime)' || key === 'Netflix' ? 70
      : key === '配件' || key === '包膜' ? 80 : 100;
    if (v < minimum) return -0.1;
    return v > 110 ? 0.1 : 0;
  }
  function n12cMetricRate(rec, key) {
    if (key === '保險搭售') return n12cInsuranceRate(rec);
    const metrics = rec?.metrics || {};
    return n(key === 'Apple服務' && !Object.prototype.hasOwnProperty.call(metrics, key) ? metrics['天下/開通'] : metrics[key]);
  }
  function parseDelimited(text) {
    text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    const delim=text.includes('\t')?'\t':',';
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'&&(quoted||cell==='')){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(!quoted&&(ch===delim||ch==='\n')){row.push(cell.trim());cell='';if(ch==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}
      else cell+=ch;
    }
    if(quoted)throw new Error('貼上資料的引號未結束，請複製完整表格');
    row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;
  }
  function n12cNormalize(value) { return String(value??'').normalize('NFKC').replace(/[\s\u3000]/g,'').toUpperCase(); }
  function n12cKpiSections(rows) {
    const normalize=n12cNormalize;
    const aliases = {
      'VK': ['MyVideo&KKBOX', 'MyVideo／KKBOX', 'V+K', 'VK'],
      'Apple服務': ['Apple&Google服務及雜誌週刊開通數', 'Google服務及雜誌週刊開通數', 'Apple服務', 'Apple服務銷售數', 'APPEL服務'],
      '影音(HBO/D+/Prime)': ['HBO Max&Disney+&Prime Video銷售數', 'HBO Max&Disney+&Prime Video銷售'],
      'Netflix': ['Netflix多享組銷售數'],
      '配件': ['配件及其他營收'], '包膜': ['包膜與保貼營收'],
      a1399:['AQ V+D 1399 (含)以上'],r1399:['RT V+D 1399 (含)以上'],broadband:['好速案銷售點數']
    };
    const sections=[];
    rows.forEach((row,r)=>{
      const values=(row||[]).map(normalize);
      if(Object.values(aliases).filter(labels=>labels.some(label=>values.includes(normalize(label)))).length<2)return;
      const cols={},labels={};let end=r;
      for(const [key,names] of Object.entries(aliases)){
        const found=new Set();
        values.forEach((label,c)=>{
          if(!names.map(normalize).includes(label))return;
          const next=values.findIndex((v,j)=>j>c&&v);const limit=next<0?c+4:Math.min(c+4,next);
          for(let rr=r+1;rr<Math.min(rows.length,r+4);rr++){
            if((rows[rr]||[]).some(x=>/^(店長|代理店長|副店長|業務代表.*|業代|銷售人員)$/.test(String(x).trim())))break;
            for(let cc=c;cc<limit;cc++)if(/^(?:進度達成率|達成率)%?$/.test(normalize(rows[rr]?.[cc]))){found.add(cc);end=Math.max(end,rr);labels[key]=String(row[c]).trim();}
          }
        });
        if(found.size===1)cols[key]=[...found][0];
      }
      if(Object.keys(cols).length)sections.push({start:r,end,cols,labels,rank:values.indexOf('排名'),total:values.indexOf('總進度達成率')});
    });
    return sections;
  }
  function n12cRateColumns(rows) { return n12cKpiSections(rows).at(-1)?.cols||{};
  }
  function n12cReadMetrics(rows, records, kind) {
    const sections = n12cKpiSections(rows);
    for(const rec of records){rec.metrics??={};for(const key of ITEMS.filter(k=>k!=='保險搭售'))rec.metrics[key]=null;}
    const byId = new Map(records.map(rec => [kind === '105' ? rec.empId : rec.store, rec]));
    const roleRe = /^(店長|代理店長|副店長|業務代表.*|業代|銷售人員)$/;
    for (let rowIndex=0;rowIndex<rows.length;rowIndex++) {
      const row=rows[rowIndex];
      const section=sections.filter(s=>s.end<rowIndex).at(-1);
      if(!section||sections.some(s=>rowIndex>=s.start&&rowIndex<=s.end))continue;
      const cols=section.cols;
      const cells = (row || []).map(x => String(x ?? '').trim());
      const ri = kind === '105' ? cells.findIndex(x => roleRe.test(x)) : -1;
      const id = kind === '105' ? ri < 1 ? null : cells[ri + 1] : cells.find(x => byId.has(x));
      const rec = byId.get(id); if (!rec) continue;
      rec.metricSources={...section.labels};rec.sourceRow=rowIndex+1;
      rec.rank=n(row[section.rank]);rec.totalProgress=rateN(row[section.total]);
      rec.focus=Object.fromEntries(['a1399','r1399','broadband'].map(k=>[k,Number.isInteger(cols[k])?rateN(row[cols[k]]):null]));
      for (const key of ITEMS.filter(k=>k!=='保險搭售')) {
        // Unknown or ambiguous columns stay pending; never reuse a fixed-index
        // value from a different metric after a report layout change.
        rec.metrics[key] = Number.isInteger(cols[key]) ? rateN(row[cols[key]]) : null;
      }
    }
    return records;
  }
  function extractPeople(rows) { return n12cReadMetrics(rows, n12cLegacyExtractPeople(rows), '105'); }
  function extractStores(rows) {
    const sections=n12cKpiSections(rows),known=new Set(EXPECTED.map(p=>p.store)),records=new Map();
    rows.forEach((row,index)=>{if(!sections.some(s=>s.end<index))return;const store=(row||[]).map(x=>String(x??'').trim()).find(x=>known.has(x));if(store)records.set(store,{store,metrics:{}});});
    return n12cReadMetrics(rows,[...records.values()],'103');
  }
  function metricClass(v, key) {
    const points = score(v, key);
    return points == null ? 'n12c-pending' : points <= -0.2 ? 'bad2' : points < 0 ? 'bad1' : points > 0 ? 'good' : '';
  }
  function n12cInsuranceParse(rows,kind) {
    const norm=n12cNormalize,candidates=[];
    for(let r=0;r<Math.min(rows.length,60);r++){
      (rows[r]||[]).forEach((value,c)=>{
        const label=norm(value);
        if(/(?:搭售|投保|附掛)率/.test(label)&&!/(?:目標|達成|差異|去年|上月)/.test(label))candidates.push({r,c,label:String(value).trim()});
      });
    }
    const preferred=candidates.filter(x=>/(?:整體|總|合計|TTL)/i.test(x.label));
    const usable=preferred.length?preferred:candidates;
    const columns=[...new Set(usable.map(x=>x.c))];
    if(columns.length!==1)return{records:[],error:columns.length?'有多個搭售率欄位，請保留整體保險搭售率欄後貼上':'未辨識到保險搭售率欄位（不採用保險服務點數）'};
    const col=columns[0],header=usable.filter(x=>x.c===col).at(-1),known=new Set(EXPECTED.map(p=>p.store));
    const people=new Set((state.people||[]).map(p=>String(p.empId)));
    const top=rows.slice(Math.max(0,header.r-2),header.r+1);
    const findCol=re=>{const set=new Set();top.forEach(row=>(row||[]).forEach((v,c)=>{if(re.test(norm(v)))set.add(c);}));return set.size===1?[...set][0]:-1;};
    const idCol=findCol(/^(?:員編|員工編號|員工代號|人員編號|人員代碼|銷售人員代碼|業務員編號)$/);
    const records=new Map(),duplicates=new Set();
    rows.slice(header.r+1).forEach(row=>{
      const cells=(row||[]).map(v=>String(v??'').trim()),store=cells.find(v=>known.has(v));
      const id=idCol>=0?cells[idCol]:cells.find(v=>people.has(v));
      const key=kind==='010508'?store:id;if(!key||kind==='010509'&&!people.has(key)&&!(idCol>=0&&/^[A-Za-z]*\d+$/.test(key)))return;
      const rate=rateN(row[col]);
      if(records.has(key)){duplicates.add(key);return;}
      records.set(key,{key,store,rate,label:header.label});
    });
    for(const key of duplicates)records.delete(key);
    return{records:[...records.values()],error:duplicates.size?'同一門市／員編出現多列，重複對象暫不計分':records.size?'':'未找到對應的門市／員編',column:col,label:header.label};
  }
  function n12cInsuranceRefresh() {
    state.insurance={};
    for(const kind of ['010508','010509']){
      const raw=state.rawUploads?.[kind];if(!raw?.rows)continue;
      const period=n12cDetectPeriod(raw.rows,raw.source);
      state.insurance[kind]={...n12cInsuranceParse(raw.rows,kind),...period,date:raw.confirmedDate||period.date,source:raw.source,updatedAt:raw.updatedAt};
    }
  }
  function n12cInsuranceRate(rec) {
    if(!rec)return null;
    const kind=rec.empId?'010509':'010508',key=String(rec.empId||rec.store||'');
    const report=state.insurance?.[kind];
    const found=report?.records?.find(x=>x.key===key);
    if(found?.store&&rec.store&&found.store!==rec.store)return null;
    return n(found?.rate);
  }
  function n12cSaveInsurance(kind,rows,source,format) {
    const result=n12cInsuranceParse(rows,kind);
    if(!result.records.length)throw new Error(result.error);
    ensureUploadStore();state.rawUploads[kind]={rows,source,format,updatedAt:new Date().toISOString()};
    n12cInsuranceRefresh();delete n12cUploadErrors[kind];persistCurrent();render();n12cRenderExtras();
    logDiag(kind+' 已連動保險搭售｜'+result.records.length+'筆');
  }
  async function applyRawFile(kind,file) {
    const job=String(Date.now())+Math.random();n12cBusy[kind]=job;delete n12cUploadErrors[kind];n12cRenderExtras();
    try{const parsed=await rowsFromFile(file);if(n12cBusy[kind]!==job)return;n12cBusy[kind]=false;n12cSaveInsurance(kind,parsed.rows,file.name,parsed.format);}
    catch(e){if(n12cBusy[kind]!==job&&n12cBusy[kind]!==false)return;n12cBusy[kind]=false;n12cUploadErrors[kind]=e.message;n12cRenderExtras();}
  }
  function applyRawPaste(kind,textareaId) {
    try{const text=document.getElementById(textareaId)?.value||'';const rows=text.includes('|')?parseMarkdown(text):parseDelimited(text);n12cSaveInsurance(kind,rows,kind+'｜貼上資料','貼上');}
    catch(e){n12cUploadErrors[kind]=e.message;n12cRenderExtras();}
  }
  function evalStore(rec) {
    const items=ITEMS.map(key=>{const rate=n12cMetricRate(rec,key);return{key,rate,score:score(rate,key)};});
    return {items,total:items.some(i=>i.score==null)?null:clean(items.reduce((a,i)=>a+i.score,0))};
  }
  function evalPerson(rec) {
    const sm=storeMap()[rec.store];
    const items=ITEMS.map(key=>{
      const rate=n12cMetricRate(rec,key),sr=n12cMetricRate(sm,key),base=score(rate,key);
      const exempt=key!=='保險搭售'&&base!=null&&base<0&&sr!=null&&sr>100;
      const missing=base==null||(key!=='保險搭售'&&base<0&&sr==null);
      return {key,rate,storeRate:sr,exempt,score:missing?null:exempt?0:base};
    });
    const total=items.some(i=>i.score==null)?null:clean(items.reduce((a,i)=>a+i.score,0));
    const ins=n12cInsuranceRate(rec);
    const gold=ins==null?0:ins<40?-20:ins<50?-10:0;
    return {items,total,ins,gold};
  }
  function metricTd(item) {
    const detail=item.score==null?'待補資料':item.exempt?'店績豁免扣分':scoreTxt(item.score);
    return '<td class="'+(item.score==null?'n12c-pending':item.exempt?'exempt':metricClass(item.rate,item.key))+'">'+pct(item.rate)+'<br><small>'+detail+'</small></td>';
  }
  function n12cDeduction(ev) {
    if (!ev || ev.total == null || !ev.items?.length || ev.items.some(i => i.score == null || !Number.isFinite(Number(i.score)))) return null;
    return clean(ev.items.reduce((sum, i) => sum + Math.min(0, Number(i.score)), 0));
  }
  function n12cDeductionText(value) {
    return value == null || !Number.isFinite(Number(value)) ? '待補資料' : '扣 ' + Math.abs(Number(value)).toFixed(1) + ' 分';
  }
  function n12cDeductionCell(ev) {
    const deduction = n12cDeduction(ev);
    return '<td class="' + (deduction == null ? 'n12c-pending' : 'n12c-deduction-cell') + '">' + n12cDeductionText(deduction) + '</td>';
  }
  function n12cSummaryDeduction(summary, periodReady) {
    if (!summary.ready) return '待補資料';
    return (periodReady && !summary.pending ? '' : '暫算 ') + n12cDeductionText(summary.minus);
  }
  function n12cValidDate(y,m,d) {
    y=Number(y);m=Number(m);d=Number(d);if(y<1911)y+=1911;
    const x=new Date(y,m-1,d);
    return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?y+'/'+String(m).padStart(2,'0')+'/'+String(d).padStart(2,'0'):null;
  }
  function n12cDetectPeriod(rows,name) {
    const text=(rows||[]).slice(0,40).map(r=>(r||[]).join(' ')).join('\n');
    const range=text.match(/(20\d{2}|1\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})\s*[~～至–—]\s*(?:(20\d{2}|1\d{2})[\/.-])?(\d{1,2})[\/.-](\d{1,2})/);
    if(range){const start=n12cValidDate(range[1],range[2],range[3]),end=n12cValidDate(range[4]||range[1],range[5],range[6]);if(start&&end)return{date:end,period:start+'～'+end};}
    const tagged=text.match(/(?:資料日期|資料日|統計迄日|截止日期|統計日期|報表日期)[^\d]{0,18}(20\d{2}|1\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
    if(tagged){const date=n12cValidDate(tagged[1],tagged[2],tagged[3]);if(date)return{date,period:date};}
    // A bare timestamp in the filename may be the download date, not the report cutoff.
    return {date:null,period:'日期未辨識'};
  }
  function n12cSourceMeta(kind) {
    const source=String(state['source'+kind]||'');
    const records=kind==='103'?state.stores:state.people;
    let m=state.sourceMeta?.[kind];
    if(!m||m.source!==source){
      const p=n12cDetectPeriod([[state['reportPeriod'+kind]||'']],source);
      m={source,date:state['date'+kind]||p.date,period:p.date?p.period:'日期未辨識',updatedAt:null};
    }
    return {...m,source,count:(records||[]).length,real:!!source&&!/內建|快照範例/.test(source)&&(records||[]).length>0};
  }
  function n12cPeriodReady() {
    const a=n12cSourceMeta('103'),b=n12cSourceMeta('105');
    if(Object.values(n12cBusy).some(Boolean))return {ok:false,reason:'正在讀取新報表，以下仍為上一份資料。'};
    if(Object.values(n12cUploadErrors).some(Boolean))return {ok:false,reason:'上傳未成功，尚未改用新檔；請查看資料連動狀態。'};
    if(!a.real||!b.real)return{ok:false,reason:'仍有內建快照或未上傳的報表，不能當成本期結算。'};
    if(!a.date||!b.date)return{ok:false,reason:'至少一份報表的資料日未辨識；請在「資料連動狀態」確認截止日，不必重傳。'};
    if(a.date!==b.date)return{ok:false,reason:'010103／010105資料日不同，暫停正式合計，避免跨日或跨月混算。'};
    for(const kind of ['010508','010509']){
      const report=state.insurance?.[kind];
      if(!report?.records?.length)return{ok:false,reason:kind+'保險搭售資料尚未連動；已知KPI仍可檢閱。'};
      if(!report.date||report.date!==a.date)return{ok:false,reason:kind+'保險報表資料日未確認或與KPI不同，以下為暫算。'};
    }
    if(state.stores.length!==new Set(EXPECTED.map(p=>p.store)).size)return{ok:false,reason:'店績資料未涵蓋完整九店，請先確認010103。'};
    return{ok:true,reason:'四份報表資料日一致：'+a.date+'。所有分頁共用目前載入資料。'};
  }
  function n12cUpdateMeta(kind,rows,source,format) {
    const period=n12cDetectPeriod(rows,source);
    state.sourceMeta??={};state.sourceMeta[kind]={...period,source,format,updatedAt:new Date().toISOString()};
    state['source'+kind]=source;state['date'+kind]=period.date;state['reportPeriod'+kind]=period.date?period.period:'';
    if(period.date)state.date=period.date;
    state.ruleVersion=N12C_RULE_VERSION;
    state.rawUploads??={};state.rawUploads['010'+kind]={rows,source,format,updatedAt:new Date().toISOString()};
    n12cInsuranceRefresh();
  }
  function n12cUploadStatus(kind,message,level) {
    const cls=level||'ok';
    for(const id of ['status'+kind,'uploadStatus'+kind]){
      const e=document.getElementById(id);if(e){e.textContent=message;e.className=(id.startsWith('upload')?'mini-status ':'status ')+cls;}
    }
  }
  async function applyFile(kind,file) {
    const job=String(Date.now())+Math.random();n12cBusy[kind]=job;delete n12cUploadErrors[kind];
    n12cUploadStatus(kind,'讀取中：'+file.name,'warn');n12cRenderExtras();
    try{
      const parsed=await rowsFromFile(file);
      if(n12cBusy[kind]!==job)return;
      let data=kind==='105'?extractPeople(parsed.rows):extractStores(parsed.rows);
      const stores=new Set(EXPECTED.map(p=>p.store));data=data.filter(r=>stores.has(r.store));
      if(!data.length)throw new Error(kind==='105'?'找不到本區010105個人資料':'找不到010103九店資料或欄位標題');
      if(data.every(r=>ITEMS.every(k=>n(r.metrics?.[k])==null)))throw new Error('未讀到六項達成率，保留上一份資料，請確認報表類別');
      if(kind==='105')state.people=data;else state.stores=data;
      n12cUpdateMeta(kind,parsed.rows,file.name,parsed.format);
      n12cBusy[kind]=false;persistCurrent();
      logDiag('010'+kind+' 更新成功｜'+data.length+(kind==='103'?'店':'人')+'｜六項SPE與各分頁同步重算');
      render();n12cRenderExtras();
    }catch(e){
      if(n12cBusy[kind]!==job)return;
      n12cBusy[kind]=false;n12cUploadErrors[kind]=String(e.message||e);
      n12cUploadStatus(kind,'未更新：'+n12cUploadErrors[kind]+'（保留上一份資料）','bad');
      logDiag('010'+kind+' 更新失敗：'+n12cUploadErrors[kind]);n12cRenderExtras();
    }
  }
  function applyPaste(kind) {
    const text=document.getElementById(kind==='105'?'paste105':'paste103')?.value?.trim();if(!text)return;
    try{
      const rows=text.includes('|')?parseMarkdown(text):parseDelimited(text);
      const known=new Set(EXPECTED.map(p=>p.store));
      const data=(kind==='105'?extractPeople(rows):extractStores(rows)).filter(p=>known.has(p.store));
      if(!data.length)throw new Error('未辨識到本區資料');
      if(data.every(r=>ITEMS.filter(k=>k!=='保險搭售').every(k=>n(r.metrics?.[k])==null)))throw new Error('未讀到六項達成率，保留上一份資料');
      if(kind==='105')state.people=data;else state.stores=data;
      n12cUpdateMeta(kind,rows,'010'+kind+'｜Excel貼上資料','貼上');
      delete n12cUploadErrors[kind];persistCurrent();render();n12cRenderExtras();
    }catch(e){n12cUploadErrors[kind]=String(e.message||e);n12cRenderExtras();}
  }
  function n12cScoreRows() {
    const all=new Map();
    for(const p of state.people||[])if(p.empId)all.set(String(p.empId),p);
    // The uploaded report is the current roster; a historical roster must not block settlement.
    const sm=storeMap();
    return Array.from(all.values()).map(rec=>{
      const manager=managerRole(rec.role),ev=manager?evalStore(sm[rec.store]):evalPerson(rec);
      if(rec.missing)ev.total=null;
      return {rec,manager,ev};
    });
  }
  function n12cTotals(rows) {
    const ready=rows.filter(x=>!x.rec.missing&&x.ev.total!=null);
    const points=ready.flatMap(x=>x.ev.items).map(i=>i.score);
    return {count:rows.length,ready:ready.length,pending:rows.length-ready.length,
      plus:clean(points.filter(v=>v>0).reduce((a,b)=>a+b,0)),
      minus:clean(points.filter(v=>v<0).reduce((a,b)=>a+b,0)),
      net:clean(ready.reduce((a,x)=>a+x.ev.total,0))};
  }
  function n12cTotalText() {
    const check=n12cPeriodReady(),s=n12cTotals(n12cScoreRows());
    return ['【北一二C｜一條龍7項SPE總分】', '規則版本：'+N12C_RULE_VERSION,
      '010103：'+(n12cSourceMeta('103').date||'未確認日期')+'｜010105：'+(n12cSourceMeta('105').date||'未確認日期'),
      check.ok&&s.pending===0?'可結算':'暫算／尚不可完整結算',check.reason,
      '全區人員SPE總計扣分：'+n12cSummaryDeduction(s,check.ok),
      '已知人員淨總分：'+scoreTxt(s.net)+'｜加分：'+scoreTxt(s.plus),
      '完整 '+s.ready+' 人；待補 '+s.pending+' 人。',
      'V+K／Apple<100% −0.1；影音／Netflix<70% −0.1；配件／包膜<50% −0.2、50%～未滿80% −0.1；各項>110% +0.1。',
      '店長只採店績一次；前六項套用店績＞100%豁免扣分；保險搭售低於45%另扣0.1，無豁免或加分；保險金牌不計入SPE。'].join('\n');
  }
  function n12cExportCsv() {
    const rows=n12cScoreRows(),check=n12cPeriodReady(),summary=n12cTotals(rows);
    const head=['010508資料日','010509資料日','010103資料日','010105資料日','規則版本','門市','員編','姓名','職稱','認列方式',...ITEMS.flatMap(k=>[k+'達成率',k+'計分',k+'豁免扣分']),'SPE總計扣分','SPE淨分','結算狀態'];
    const a=n12cSourceMeta('103'),b=n12cSourceMeta('105');
    const body=rows.map(x=>[state.insurance?.['010508']?.date||'未確認',state.insurance?.['010509']?.date||'未確認',a.date||'未確認',b.date||'未確認',N12C_RULE_VERSION,x.rec.store,x.rec.empId,x.rec.name,x.rec.role,x.manager?'店績':'個人',...x.ev.items.flatMap(i=>[i.rate==null?'':i.rate,i.score==null?'':i.score,i.exempt?'是':'否']),n12cDeduction(x.ev)??'',x.ev.total==null?'':x.ev.total,x.rec.missing?'人員未載入':x.ev.total==null?'待補資料':check.ok&&summary.pending===0?'可結算':'暫算']);
    const quote=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const blob=new Blob(['\uFEFF'+[head,...body].map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='N12C_一條龍7項SPE_'+(a.date||'日期待確認').replaceAll('/','-')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function n12cRenderExtras() {
    const panel=document.getElementById('n12cSourceStatus');if(!panel)return;
    n12cInsuranceRefresh();
    const dates=[];
    panel.textContent=['103','105'].map(k=>{
      const m=n12cSourceMeta(k);if(m.date)dates.push(m.date);
      const issue=n12cBusy[k]?'正在讀取新檔':n12cUploadErrors[k]?'未更新：'+n12cUploadErrors[k]:m.real?'已載入':'內建快照／非本期結算資料';
      const message='010'+k+'｜'+issue+'｜'+m.count+(k==='103'?'店':'人')+'｜資料日：'+(m.date||'未辨識')+'\n來源：'+(m.source||'未上傳');
      n12cUploadStatus(k,message,n12cBusy[k]||!m.real||!m.date?'warn':n12cUploadErrors[k]?'bad':'ok');
      const records=k==='103'?state.stores:state.people;
      const missing=[...new Set((records||[]).flatMap(r=>ITEMS.filter(key=>key!=='保險搭售'&&n12cMetricRate(r,key)==null)))];
      const labels=[...new Set((records||[]).map(r=>r.metricSources?.['Apple服務']).filter(Boolean))];
      return message+(labels.length?'\n服務開通來源欄：'+labels.join('、'):'')+(missing.length?'\n待補欄位：'+missing.join('、')+'；請重新套用原報表，無須修改數字。':'');
    }).join('\n\n');
    for(const kind of ['010508','010509']){
      const report=state.insurance?.[kind],raw=state.rawUploads?.[kind];
      const message=kind+'｜'+(n12cBusy[kind]?'讀取中':n12cUploadErrors[kind]?'未更新：'+n12cUploadErrors[kind]:!raw?'尚未上傳':report?.error||((report?.records?.length||0)+'筆已連動'))+'｜資料日：'+(report?.date||'未辨識')+'\n來源：'+(raw?.source||'尚未上傳');
      panel.textContent+='\n\n'+message;n12cUploadStatus(kind.slice(3),message,report?.records?.length&&!report.error&&!n12cUploadErrors[kind]?'ok':'warn');
    }
    const check=n12cPeriodReady(),rows=n12cScoreRows(),s=n12cTotals(rows);
    document.getElementById('n12cNet').textContent=s.ready?(check.ok&&s.pending===0?'':'暫算 ')+scoreTxt(s.net):'待補資料';
    document.getElementById('n12cPlus').textContent=s.ready?scoreTxt(s.plus):'待補資料';
    const deductionText=n12cSummaryDeduction(s,check.ok);
    document.getElementById('n12cMinus').textContent=deductionText;
    document.getElementById('n12cDeductionSummary').textContent=deductionText;
    document.getElementById('n12cReady').textContent=s.ready;document.getElementById('n12cPending').textContent=s.pending;
    const notice=document.getElementById('n12cTotalNotice');notice.className='complete '+(check.ok&&s.pending===0?'':'bad');
    notice.textContent=(check.ok&&s.pending===0?'✓ 可結算｜':'⚠ 暫算｜')+check.reason+(s.pending?' 尚有'+s.pending+'人資料不完整；請確認010103／010105的六項達成率，以及010508／010509保險搭售率；下方逐項標示缺值。缺值不視為0分。':'');
    const kpiReady=rows.filter(x=>x.ev.items.filter(i=>i.key!=='保險搭售').every(i=>i.score!=null));
    const kpiMinus=clean(kpiReady.flatMap(x=>x.ev.items).filter(i=>i.key!=='保險搭售').reduce((sum,i)=>sum+Math.min(0,i.score),0));
    notice.textContent+=' KPI前六項已完成 '+kpiReady.length+'/'+rows.length+' 人，扣分小計 '+Math.abs(kpiMinus).toFixed(1)+' 分（未含保險）。';
    const names=[...new Set(EXPECTED.map(p=>p.store))];
    document.getElementById('n12cStoreTotals').innerHTML='<table><thead><tr><th>門市</th><th>完整／人數</th><th>單項加分</th><th>SPE總計扣分</th><th>人員淨合計</th></tr></thead><tbody>'+names.map(name=>{const t=n12cTotals(rows.filter(x=>x.rec.store===name));return '<tr><td>'+esc(name)+'</td><td>'+t.ready+'/'+t.count+'</td><td>'+scoreTxt(t.plus)+'</td><td class="n12c-deduction-cell">'+n12cSummaryDeduction(t,check.ok)+'</td><td>'+(!check.ok||t.pending?'暫算 ':'')+scoreTxt(t.net)+'</td></tr>';}).join('')+'</tbody></table>';
    document.getElementById('n12cPersonTotals').innerHTML='<table><thead><tr><th>門市</th><th>姓名</th><th>員編</th><th>認列</th>'+ITEMS.map(k=>'<th>'+esc(k==='VK'?'V+K':k==='Apple服務'?'Apple服務／開通':k)+'</th>').join('')+'<th>SPE</th><th>狀態</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.rec.store)+'</td><td>'+esc(x.rec.name)+'</td><td>'+esc(x.rec.empId)+'</td><td>'+(x.manager?'店績':'個人')+'</td>'+x.ev.items.map(metricTd).join('')+n12cDeductionCell(x.ev)+'<td class="'+(x.ev.total<0?'score-neg':x.ev.total>0?'score-pos':'')+'">'+scoreTxt(x.ev.total)+'</td><td>'+(x.rec.missing?'人員未載入':x.ev.total==null?'待補資料':check.ok?'已重算':'暫算')+'</td></tr>').join('')+'</tbody></table>';
    // Reapply the metadata date after legacy render writes its single working date.
    const label='資料日：103 '+(n12cSourceMeta('103').date||'未確認')+'｜105 '+(n12cSourceMeta('105').date||'未確認');
    const e=document.getElementById('dataDate');if(e)e.textContent=label;
  }
  function n12cBootstrap() {
    state.sourceMeta??={};
    for(const k of ['103','105']){const raw=state.rawUploads?.['010'+k];if(raw?.rows){const data=k==='103'?extractStores(raw.rows):extractPeople(raw.rows);if(data.length)state[k==='103'?'stores':'people']=data;}}
    n12cInsuranceRefresh();
    const previous=state.ruleVersion;state.ruleVersion=N12C_RULE_VERSION;
    // Preserve the site's existing storage keys and report records; never replace them with a seed.
    for(const k of ['103','105']){
      const m=n12cSourceMeta(k);state.sourceMeta[k]={...m};
      const input=document.getElementById('n12cDate'+k);if(input&&m.date)input.value=m.date.replaceAll('/','-');
    }
    for(const k of ['508','509']){const date=state.insurance?.['010'+k]?.date;const input=document.getElementById('n12cDate'+k);if(input&&date)input.value=date.replaceAll('/','-');}
    const originalPanel=document.getElementById('file103')?.closest('section');if(originalPanel&&document.getElementById('upload103'))originalPanel.hidden=true;
    const paste103=document.getElementById('uploadApply103');if(paste103)paste103.onclick=()=>syncMainPaste('103','uploadPaste103');
    document.getElementById('n12cRecalc').onclick=()=>{render();n12cRenderExtras();switchSheet('totals');};
    document.getElementById('n12cToUpload').onclick=()=>switchSheet(document.getElementById('sheet-upload')?'upload':'overview');
    document.getElementById('n12cExport').onclick=n12cExportCsv;
    document.getElementById('n12cCopyTotals').onclick=()=>copyText(n12cTotalText());
    document.getElementById('n12cConfirmDates').onclick=()=>{
      for(const k of ['103','105']){
        const v=document.getElementById('n12cDate'+k).value;if(!v)continue;
        const [y,m,d]=v.split('-'),date=n12cValidDate(y,m,d);
        if(date){const old=n12cSourceMeta(k);state.sourceMeta[k]={...old,date,period:date,dateConfirmed:true};state['date'+k]=date;}
      }
      for(const k of ['508','509']){const v=document.getElementById('n12cDate'+k).value,raw=state.rawUploads?.['010'+k];if(v&&raw){const [y,m,d]=v.split('-');const date=n12cValidDate(y,m,d);if(date)raw.confirmedDate=date;}}
      persistCurrent();render();n12cRenderExtras();
    };
    // The legacy code binds some render callbacks directly; one shared recalculation still updates them all.
    document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>n12cRenderExtras()));
    window.addEventListener('storage',event=>{
      if(event.key!==STORAGE_KEY||!event.newValue||Object.values(n12cBusy).some(Boolean))return;
      try{const fresh=JSON.parse(event.newValue);if(Array.isArray(fresh.stores)&&Array.isArray(fresh.people)){state=fresh;render();n12cRenderExtras();}}catch(e){logDiag('另一分頁資料無法讀取：'+e.message);}
    });
    if(previous!==N12C_RULE_VERSION)logDiag('已套用固定網站修正版 '+N12C_RULE_VERSION+'；保留既有報表，修正多列表頭並連動保險搭售；舊版未保留原始表格者請重新套用原檔。');
  }
  window.n12cUpgradeHtml=upgradeHtml;
  window.n12cUpgradeVersion=VERSION;
  window.n12cUpgradeLoaderVersion=LOADER_VERSION;
})();

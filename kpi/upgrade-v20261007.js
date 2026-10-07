/* N12C daily-review patch. Application code only; no report rows or credentials. */
(function () {
  'use strict';
  const VERSION = '2026-10-07.1';
  function upgradeHtml(input) {
    let html = String(input);
    const replaceOnce = (oldText, newText) => {
      if (!html.includes(oldText)) throw new Error('管理頁版本不符，已停止套用以避免錯算：' + oldText.slice(0, 36));
      html = html.replace(oldText, newText);
    };
    replaceOnce('const ITEMS=["影音(HBO/D+/Prime)","Netflix","配件","包膜","保險","VK","天下/開通"];', 'const ITEMS=["配件","包膜","VK","天下/開通"];');
    replaceOnce('function score(v){if(v==null)return 0;if(v<70)return-.2;if(v<100)return-.1;if(v>110)return .1;return 0;}', 'function score(v){if(v==null||!Number.isFinite(Number(v)))return null;if(v<100)return-.1;if(v>110)return .1;return 0;}');
    html = html.replace('rank:rateN(r[6])', 'rank:n(r[6])');
    // This undefined variable used to abort the review when any roster member was missing.
    html = html.replaceAll('.map(rec=>({rec:x,ev:null,missing:true}))', '.map(rec=>({rec,ev:null,missing:true}))');
    html = html.replaceAll('9/28前請先確認名單', '請先確認本期名單');
    html = html.replaceAll('9/28', '每日');
    html = html.replaceAll('每日需上線檢閱EXCEL明細', '依目前載入報表檢閱');
    html = html.replaceAll('規則：<70% -0.2｜<100% -0.1｜>110% +0.1', '四項規則：<100% -0.1｜100~110% 0｜>110% +0.1（排除保險、影音、Netflix）');
    html = html.replace(/<div class="rules">[\s\S]*?<\/div>/, '<div class="rules"><strong>附掛4項：配件、包膜、VK、天下／開通</strong><br>◆ <b>未達100% → 每項 SPE −0.1</b>｜100%～110% → 0｜<span class="good">超過110% → +0.1</span><br>◆ 店績同項超過100%，個人未達項豁免扣分；店長／代理店長只採店績。<br>◆ 保險、影音、Netflix不納入SPE；保險金牌仍為獨立提醒。</div>');
    html = html.replace('Y2609 管理辦法｜固定網頁版', '每日管理檢閱｜附掛4項總分');
    const syncUi = `<section class="panel" id="n12cSyncPanel"><div class="panel-title">資料連動狀態 <small>修正版 ${VERSION}</small></div><div id="n12cSourceStatus" class="copybox"></div><div class="controls" style="margin-top:10px"><button class="btn btn-blue" id="n12cRecalc">重新檢閱／計算總分</button><button class="btn btn-soft" id="n12cToUpload">前往資料上傳</button></div><details><summary>報表日期未辨識時，在此確認（不必重傳）</summary><div class="controls" style="margin-top:8px"><label>010103 資料截止日 <input type="date" id="n12cDate103"></label><label>010105 資料截止日 <input type="date" id="n12cDate105"></label><button class="btn btn-soft" id="n12cConfirmDates">確認資料日期</button></div><div class="note">此處是報表資料日，不是今天日期；兩份報表的截止日須一致才可確認結算。</div></details></section>`;
    replaceOnce('<section id="sheet-overview"', syncUi + '\n<section id="sheet-overview"');
    replaceOnce('<div class="tabs">', '<div class="tabs"><button class="tab" data-sheet="totals">SPE總分計算</button>');
    const totalsUi = `<section id="sheet-totals" class="sheet"><div class="panel"><div class="panel-title">附掛4項｜SPE總分計算</div><div id="n12cTotalNotice" class="complete"></div><div class="summary" style="margin-top:10px"><div class="sum blue"><div class="n" id="n12cNet">—</div><div class="t">人員淨總分（含店長）</div></div><div class="sum green"><div class="n" id="n12cPlus">—</div><div class="t">單項加分合計</div></div><div class="sum red"><div class="n" id="n12cMinus">—</div><div class="t">單項扣分合計</div></div><div class="sum"><div class="n" id="n12cReady">0</div><div class="t">資料完整人數</div></div><div class="sum red"><div class="n" id="n12cPending">0</div><div class="t">待補資料人數</div></div></div><div class="controls" style="margin-top:10px"><button class="btn btn-blue" id="n12cExport">匯出計分CSV</button><button class="btn btn-soft" id="n12cCopyTotals">複製總分摘要</button></div><div class="note">一般同仁以個人成績計算，店績同項＞100%免除該項個人扣分；個人＞110%仍保留加分。店長／代理店長只計一次店績，店績合計不再重複加進人員總分。保險金牌不列入SPE。</div></div><div class="panel"><div class="panel-title">各店人員合計</div><div class="table-wrap" id="n12cStoreTotals"></div></div><div class="panel"><div class="panel-title">每人四項計分明細</div><div class="table-wrap" id="n12cPersonTotals"></div></div></section>`;
    replaceOnce('<section id="sheet-store"', totalsUi + '\n<section id="sheet-store"');
    html = html.replace('</style>', '#n12cSyncPanel small{font-size:13px;color:var(--muted)}#n12cSourceStatus{overflow-wrap:anywhere}#n12cPersonTotals table,#n12cStoreTotals table{font-size:17px}#n12cPersonTotals td small{font-size:12px}.bad1{background:var(--redsoft)!important;color:var(--red)!important;font-weight:900}.n12c-pending{color:#8a4b00;background:#fff4d8;font-weight:800}#n12cSyncPanel input{padding:7px;border:1px solid #bbc3d4;border-radius:7px}\n</style>');
    // All old listeners keep their functions, while every render uses the patched shared state.
    replaceOnce('function renderFilters(){', 'function renderFilters(){\n n12cRenderExtras();');
    const functions = [scoreTxt, metricClass, evalStore, evalPerson, metricTd,
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
    return html;
  }

  function scoreTxt(x) { if(x==null||!Number.isFinite(Number(x)))return '待補'; x=clean(x); return x>0?'+'+x.toFixed(1):x.toFixed(1); }
  function metricClass(v) { return v==null?'exempt':v<100?'bad1':v>110?'good':''; }
  function evalStore(rec) {
    const items=ITEMS.map(key=>{const rate=n(rec?.metrics?.[key]);return{key,rate,score:score(rate)};});
    return {items,total:items.some(i=>i.score==null)?null:clean(items.reduce((a,i)=>a+i.score,0))};
  }
  function evalPerson(rec) {
    const sm=storeMap()[rec.store];
    const items=ITEMS.map(key=>{
      const rate=n(rec.metrics?.[key]),sr=n(sm?.metrics?.[key]);
      const exempt=rate!=null&&rate<100&&sr!=null&&sr>100;
      const missing=rate==null||(rate<100&&sr==null);
      return {key,rate,storeRate:sr,exempt,score:missing?null:exempt?0:score(rate)};
    });
    const total=items.some(i=>i.score==null)?null:clean(items.reduce((a,i)=>a+i.score,0));
    const ia=n(rec.insuranceActual),da=n(rec.deviceActual),ins=ia!=null&&da!=null&&da>0?ia/da*100:null;
    const gold=ins==null?0:ins<40?-20:ins<50?-10:0;
    return {items,total,ins,gold};
  }
  function metricTd(item) {
    const detail=item.score==null?'待補資料':item.exempt?'店績豁免扣分':scoreTxt(item.score);
    return '<td class="'+(item.score==null?'n12c-pending':item.exempt?'exempt':metricClass(item.rate))+'">'+pct(item.rate)+'<br><small>'+detail+'</small></td>';
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
    if(state.stores.length!==new Set(EXPECTED.map(p=>p.store)).size)return{ok:false,reason:'店績資料未涵蓋完整九店，請先確認010103。'};
    return{ok:true,reason:'兩份報表資料日一致：'+a.date+'。所有分頁共用目前載入資料。'};
  }
  function n12cUpdateMeta(kind,rows,source,format) {
    const period=n12cDetectPeriod(rows,source);
    state.sourceMeta??={};state.sourceMeta[kind]={...period,source,format,updatedAt:new Date().toISOString()};
    state['source'+kind]=source;state['date'+kind]=period.date;state['reportPeriod'+kind]=period.date?period.period:'';
    if(period.date)state.date=period.date;
    state.ruleVersion=N12C_RULE_VERSION;
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
      if(data.every(r=>ITEMS.every(k=>n(r.metrics?.[k])==null)))throw new Error('未讀到四項達成率，保留上一份資料，請確認報表類別');
      if(kind==='105')state.people=data;else state.stores=data;
      n12cUpdateMeta(kind,parsed.rows,file.name,parsed.format);
      n12cBusy[kind]=false;persistCurrent();
      logDiag('010'+kind+' 更新成功｜'+data.length+(kind==='103'?'店':'人')+'｜四項SPE與各分頁同步重算');
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
      if(kind==='105')state.people=data;else state.stores=data;
      n12cUpdateMeta(kind,rows,'010'+kind+'｜Excel貼上資料','貼上');
      delete n12cUploadErrors[kind];persistCurrent();render();n12cRenderExtras();
    }catch(e){n12cUploadErrors[kind]=String(e.message||e);n12cRenderExtras();}
  }
  function n12cScoreRows() {
    const all=new Map();
    for(const p of state.people||[])if(p.empId)all.set(String(p.empId),p);
    for(const p of EXPECTED)if(!all.has(String(p.empId)))all.set(String(p.empId),{...p,missing:true});
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
    return ['【北一二C｜附掛4項SPE總分】', '規則版本：'+N12C_RULE_VERSION,
      '010103：'+(n12cSourceMeta('103').date||'未確認日期')+'｜010105：'+(n12cSourceMeta('105').date||'未確認日期'),
      check.ok&&s.pending===0?'可結算':'暫算／尚不可完整結算',check.reason,
      '已知人員淨總分：'+scoreTxt(s.net)+'｜加分：'+scoreTxt(s.plus)+'｜扣分：'+scoreTxt(s.minus),
      '完整 '+s.ready+' 人；待補 '+s.pending+' 人。',
      '配件、包膜、VK、天下／開通；未達100% −0.1，超過110% +0.1。',
      '店長只採店績一次；未達項套用店績＞100%豁免扣分；保險金牌不計入SPE。'].join('\n');
  }
  function n12cExportCsv() {
    const rows=n12cScoreRows(),check=n12cPeriodReady(),summary=n12cTotals(rows);
    const head=['010103資料日','010105資料日','規則版本','門市','員編','姓名','職稱','認列方式',...ITEMS.flatMap(k=>[k+'達成率',k+'計分',k+'豁免扣分']),'SPE合計','結算狀態'];
    const a=n12cSourceMeta('103'),b=n12cSourceMeta('105');
    const body=rows.map(x=>[a.date||'未確認',b.date||'未確認',N12C_RULE_VERSION,x.rec.store,x.rec.empId,x.rec.name,x.rec.role,x.manager?'店績':'個人',...x.ev.items.flatMap(i=>[i.rate==null?'':i.rate,i.score==null?'':i.score,i.exempt?'是':'否']),x.ev.total==null?'':x.ev.total,x.rec.missing?'人員未載入':x.ev.total==null?'待補資料':check.ok&&summary.pending===0?'可結算':'暫算']);
    const quote=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const blob=new Blob(['\uFEFF'+[head,...body].map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='N12C_附掛4項SPE_'+(a.date||'日期待確認').replaceAll('/','-')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function n12cRenderExtras() {
    const panel=document.getElementById('n12cSourceStatus');if(!panel)return;
    const dates=[];
    panel.textContent=['103','105'].map(k=>{
      const m=n12cSourceMeta(k);if(m.date)dates.push(m.date);
      const issue=n12cBusy[k]?'正在讀取新檔':n12cUploadErrors[k]?'未更新：'+n12cUploadErrors[k]:m.real?'已載入':'內建快照／非本期結算資料';
      const message='010'+k+'｜'+issue+'｜'+m.count+(k==='103'?'店':'人')+'｜資料日：'+(m.date||'未辨識')+'\n來源：'+(m.source||'未上傳');
      n12cUploadStatus(k,message,n12cBusy[k]||!m.real||!m.date?'warn':n12cUploadErrors[k]?'bad':'ok');
      return message;
    }).join('\n\n');
    const check=n12cPeriodReady(),rows=n12cScoreRows(),s=n12cTotals(rows);
    document.getElementById('n12cNet').textContent=(check.ok&&s.pending===0?'':'暫算 ')+scoreTxt(s.net);
    document.getElementById('n12cPlus').textContent=scoreTxt(s.plus);document.getElementById('n12cMinus').textContent=scoreTxt(s.minus);
    document.getElementById('n12cReady').textContent=s.ready;document.getElementById('n12cPending').textContent=s.pending;
    const notice=document.getElementById('n12cTotalNotice');notice.className='complete '+(check.ok&&s.pending===0?'':'bad');
    notice.textContent=(check.ok&&s.pending===0?'✓ 可結算｜':'⚠ 暫算｜')+check.reason+(s.pending?' 尚有'+s.pending+'人資料不完整；只列已知部分合計，缺值不視為0分。':'');
    const names=[...new Set(EXPECTED.map(p=>p.store))];
    document.getElementById('n12cStoreTotals').innerHTML='<table><thead><tr><th>門市</th><th>完整／人數</th><th>單項加分</th><th>單項扣分</th><th>人員淨合計</th></tr></thead><tbody>'+names.map(name=>{const t=n12cTotals(rows.filter(x=>x.rec.store===name));return '<tr><td>'+esc(name)+'</td><td>'+t.ready+'/'+t.count+'</td><td>'+scoreTxt(t.plus)+'</td><td>'+scoreTxt(t.minus)+'</td><td>'+(!check.ok||t.pending?'暫算 ':'')+scoreTxt(t.net)+'</td></tr>';}).join('')+'</tbody></table>';
    document.getElementById('n12cPersonTotals').innerHTML='<table><thead><tr><th>門市</th><th>姓名</th><th>員編</th><th>認列</th>'+ITEMS.map(k=>'<th>'+esc(k)+'</th>').join('')+'<th>SPE</th><th>狀態</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.rec.store)+'</td><td>'+esc(x.rec.name)+'</td><td>'+esc(x.rec.empId)+'</td><td>'+(x.manager?'店績':'個人')+'</td>'+x.ev.items.map(metricTd).join('')+'<td class="'+(x.ev.total<0?'score-neg':x.ev.total>0?'score-pos':'')+'">'+scoreTxt(x.ev.total)+'</td><td>'+(x.rec.missing?'人員未載入':x.ev.total==null?'待補資料':check.ok?'已重算':'暫算')+'</td></tr>').join('')+'</tbody></table>';
    // Reapply the metadata date after legacy render writes its single working date.
    const label='資料日：103 '+(n12cSourceMeta('103').date||'未確認')+'｜105 '+(n12cSourceMeta('105').date||'未確認');
    const e=document.getElementById('dataDate');if(e)e.textContent=label;
  }
  function n12cBootstrap() {
    state.sourceMeta??={};
    const previous=state.ruleVersion;state.ruleVersion=N12C_RULE_VERSION;
    // Preserve the site's existing storage keys and report records; never replace them with a seed.
    for(const k of ['103','105']){
      const m=n12cSourceMeta(k);state.sourceMeta[k]={...m};
      const input=document.getElementById('n12cDate'+k);if(input&&m.date)input.value=m.date.replaceAll('/','-');
    }
    const originalPanel=document.getElementById('file103')?.closest('section');if(originalPanel&&document.getElementById('upload103'))originalPanel.hidden=true;
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
      persistCurrent();render();n12cRenderExtras();
    };
    // The legacy code binds some render callbacks directly; one shared recalculation still updates them all.
    document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>n12cRenderExtras()));
    window.addEventListener('storage',event=>{
      if(event.key!==STORAGE_KEY||!event.newValue||Object.values(n12cBusy).some(Boolean))return;
      try{const fresh=JSON.parse(event.newValue);if(Array.isArray(fresh.stores)&&Array.isArray(fresh.people)){state=fresh;render();n12cRenderExtras();}}catch(e){logDiag('另一分頁資料無法讀取：'+e.message);}
    });
    if(previous!==N12C_RULE_VERSION)logDiag('已套用固定網站修正版 '+N12C_RULE_VERSION+'；保留既有報表，四項SPE重新計算。');
  }
  window.n12cUpgradeHtml=upgradeHtml;
  window.n12cUpgradeVersion=VERSION;
})();

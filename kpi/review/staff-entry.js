/** Staff handoff UI. Uses the existing authenticated app, parser and save path.
 * No credentials, KPI data or report payloads are stored or published here.
 * The current staff gate in app.js is overallProgress < 80 (strictly below).
 */
export function installStaffEntry(doc=document, win=window) {
  const get=id=>doc.getElementById(id);
  if (!get('sessionLabel') || get('staffWorkflow')) return;
  const setText=(node,text)=>{ if(node && node.textContent!==text)node.textContent=text; };
  const signedIn=()=>get('sessionLabel').classList.contains('online');
  const isStaff=()=>signedIn() && /^同仁\s*·|^個人填報\s*·/.test(get('sessionLabel').textContent);
  const style=doc.createElement('style');
  style.textContent='.staff-workflow{margin:18px 0;padding:20px;border:1px solid #cfdae7;border-radius:16px;background:white}.staff-workflow h2{margin:0 0 10px;font-size:22px}.staff-workflow p{margin:7px 0;line-height:1.65}.staff-workflow .staff-task{font-weight:700}.staff-workflow[data-due="yes"]{border-left:5px solid #c53b44}.staff-workflow .button-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.staff-workflow[hidden]{display:none!important}@media(max-width:600px){.staff-workflow{padding:16px}.staff-workflow .button-row .button{flex:1;min-width:150px}}';
  doc.head.append(style);
  const panel=doc.createElement('section');
  panel.id='staffWorkflow';panel.className='staff-workflow';panel.hidden=true;
  panel.setAttribute('aria-labelledby','staffWorkflowTitle');
  panel.innerHTML='<h2 id="staffWorkflowTitle">我的績效確認與回報</h2><p>① 閱讀頁籤一的本人 KPI，按「確認已閱讀」。<br>② 總進度低於 80% 者，直接進入頁籤二填寫改善回報。<br>③ 按「檢核並存檔」，顯示「已存檔 · 待主管核實」後，再下載一頁圖片。</p><p id="staffWorkflowTask" class="staff-task" role="status"></p><p id="staffWorkflowSaved" class="muted"></p><div class="button-row"><button id="staffGoReport" class="button button-primary" type="button">前往頁籤二回報</button><button id="staffRefresh" class="button" type="button">更新本人資料</button></div><p class="muted">只需使用員編與密碼登入此網址，不需重新上傳 Excel。閱讀確認不等於完成改善回報；接觸電話請隱碼，例如 0958***896。</p>';
  doc.querySelector('nav.tabs').before(panel);
  get('staffGoReport').onclick=()=>get('tab-reports').click();
  get('staffRefresh').onclick=()=>win.location.reload();
  const share=doc.createElement('button');share.type='button';share.id='shareStaffEntry';share.className='button button-small';share.textContent='同仁登入連結';share.hidden=true;
  get('loginOpen').before(share);
  const shareURL=()=>new URL('./',win.location.href).href;
  function openShare(){
    setText(get('infoTitle'),'同仁共用登入連結');
    const root=get('infoContent');root.replaceChildren();
    const p=doc.createElement('p');p.textContent='將同一個網址提供全體同仁。使用本人員編與密碼登入後，閱讀本人績效；總進度低於80%者直接到頁籤二回報。首次登入依提示修改初始密碼。';
    const label=doc.createElement('label');label.textContent='固定登入網址';
    const input=doc.createElement('input');input.readOnly=true;input.value=shareURL();input.id='staffSharedURL';input.style.width='100%';input.onclick=()=>input.select();label.append(input);
    const b=doc.createElement('button');b.type='button';b.className='button button-primary';b.textContent='複製網址';
    b.onclick=async()=>{try{await win.navigator.clipboard.writeText(input.value);b.textContent='已複製網址';}catch{input.focus();input.select();b.textContent='請複製已選取網址';}};
    root.append(p,label,b);if(!get('infoDialog').open)get('infoDialog').showModal();
  }
  share.onclick=openShare;
  const access=get('accessOpen');
  if(access){access.textContent='同仁共用登入連結';access.onclick=openShare;}
  const ruleBar=get('rule')?.closest('.rule-bar');
  function update(){
    const staff=isStaff();panel.hidden=!staff;share.hidden=!signedIn()||staff;
    if(ruleBar)ruleBar.hidden=staff;
    const filters=doc.querySelector('.board-panel .filter-row');if(filters)filters.hidden=staff;
    if(!staff)return;
    const row=get('dashboardTable')?.querySelector('tbody tr');
    const rate=row?.querySelector('td:nth-child(4) .rate-pill');
    const hasRate=!!rate && !rate.classList.contains('muted');
    const due=hasRate && rate.classList.contains('danger');
    panel.dataset.due=due?'yes':'no';
    setText(get('staffWorkflowTask'),!hasRate?'目前沒有可判定的總進度，請主管確認本次報表是否包含您的員編。':due?'本次總進度低於80%管理線：須完成頁籤二回報（以原始數值判斷，不以顯示的四捨五入數值判斷）。':'您的總進度為 '+rate.textContent+'，本次未低於80%管理線；請完成頁籤一閱讀確認。');
    get('staffGoReport').disabled=!due;
    setText(get('queueCount'),due?'1':'0');
    const card=get('summaryCards')?.children[2];
    if(card){setText(card.querySelector('.summary-label'),'總進度低於 80% · 需回報');setText(card.querySelector('strong'),due?'1':'0');setText(card.querySelector('small'),'與頁籤二的同仁回報管理線一致');}
    // Align only staff navigation with the existing overall <80 gate.
    // KPI data and server-side authorization are never changed here.
    const cell=row?.lastElementChild;
    const small=row?.querySelector('.person-cell small');
    const id=small?.textContent.trim().split(/\s/)[0];
    if(cell && id){
      const b=cell.querySelector('[data-open-report]');
      if(due && !b){const next=doc.createElement('button');next.type='button';next.className='row-action';next.dataset.openReport=id;next.textContent='需回報';cell.replaceChildren(next);}
      if(!due && b){const span=doc.createElement('span');span.className='muted';span.textContent='本次免回報';cell.replaceChildren(span);}
    }
    const reportStatus=get('reportStatus')?.textContent||'';
    const reportDate=get('reportDateSelect')?.value||'';
    const currentDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    setText(get('staffWorkflowSaved'),reportDate===currentDate && /已存檔|已核實|已退回|已修改/.test(reportStatus)?'今日回報狀態：'+reportStatus:'回報成功與否，請以頁籤二的存檔狀態為準。');
  }
  const observer=new MutationObserver(update);
  for(const id of ['sessionLabel','dashboardTable','summaryCards','reportStatus']){
    const node=get(id);if(node)observer.observe(node,{childList:true,subtree:true,characterData:true,attributes:id==='sessionLabel',attributeFilter:id==='sessionLabel'?['class']:undefined});
  }
  update();
}
installStaffEntry();

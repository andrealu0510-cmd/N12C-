'use strict';
/* Authenticated promotion import. No customer data or promotion payload is published here. */
(() => {
 function runtime(bundle) {
  const data=bundle.data, modelById=new Map(data.models.map(m=>[m.id,m]));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n).toLocaleString('en-US');
  const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/motorola/g,'moto').replace(/[\s_\-()]/g,'');
  const cat={base:'指定專案購機',trade:'舊換新',loyal:'老客戶續約',home:'回娘家',friend:'新朋友',upgrade:'升轉／4升5','4to5':'升轉／4升5',tst:'TST用戶'};
  function modelKey(raw){const core=normalize(raw.split('_')[0]);return bundle.pack.models&&Object.entries(bundle.pack.models).sort((a,b)=>b[1].length-a[1].length).find(([,name])=>{const key=normalize(name);return core===key||core===key.replace(/^apple/,'')||(/^applemac/.test(key)&&core.startsWith(key))||((/samsunggalaxy/.test(key))&&new RegExp('^'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[sa]\\d+[a-z0-9]*$').test(core));})?.[0]||null;}
  const constraints=q=>({rate:q.rate??(q.rates?.length===1?q.rates[0]:null),term:q.months?.length===1?q.months[0]:typeof q.months==='number'?q.months:null,date:q.date||bundle.month+'-01'});
  function tierMatch(t,c){return(c.rate==null||((t.min==null||c.rate>=t.min)&&(t.max==null||c.rate<=t.max)))&&(c.term==null||!t.terms?.length||t.terms.includes(c.term));}
  function reason(o,q){const c=constraints(q),rs=[];if(o.status==='關閉')rs.push('已於'+o.end+'結束，11月不適用');else if(o.start&&c.date<o.start)rs.push('尚未開始');else if(o.end&&c.date>o.end)rs.push('已超過活動期限');
   if(c.rate!=null&&o.minimum!=null&&c.rate<o.minimum)rs.push('資費未達'+o.minimum);if(c.term!=null&&o.terms.length&&!o.terms.includes(c.term))rs.push('約期不符');
   if(c.rate===1399&&c.term===48&&o.note.includes('1399資費48個月不適用'))rs.push('1399／48個月不適用');
   if(o.tiers.length&&!o.tiers.some(t=>tierMatch(t,c)))rs.push('資費／約期不符');
   if(q.service&&q.service!=='RT'&&o.condition.includes('續約'))rs.push('本活動限續約');
   if(q.is4G||q.notCbg)rs.push('請核對本次5G專案資格');
   if(q.enterprise&&o.note.includes('企客案')||q.selectT&&o.note.includes('精選T案'))rs.push('此專案不適用');
   if(o.category==='回娘家'&&q.owner){if(o.condition.includes('vivo')&&q.owner!=='vivo')rs.push('限現持vivo機款');if(o.condition.includes('Google Pixel')&&q.owner!=='pixel')rs.push('限現持Google Pixel機款');}
   if(o.category==='新朋友'&&q.owner&&!['vivo','nonGoogle'].includes(q.owner))rs.push('限現持非Google機款');
   return rs;
  }
  function comboReason(c,q){const x=constraints(q);return (x.term!=null&&c.condition.includes('48個月')&&x.term!==48)||(x.term===48&&c.condition.includes('24／30／36個月'))||(x.rate!=null&&c.condition.includes('1399含以上')&&x.rate<1399)||(x.rate!=null&&c.condition.includes('999含以上')&&x.rate<999);}
  function card(mid,oid,q={}){const m=modelById.get(mid),o=m?.offers.find(o=>o.id===oid);if(!o)return '';
   const c=constraints(q),rs=reason(o,q),tiers=o.tiers.filter(t=>tierMatch(t,c));
   return `<article class="promo-rule nov-offer ${rs.length?'blocked':''}"><div class="promo-card-top"><strong>${esc(o.category)}</strong><span class="promo-badge ${rs.length?'off':'wait'}">${esc(o.status)}</span></div><h3>${esc(m.brand+' '+m.name+' '+m.spec)}</h3>${rs.length?`<p class="nov-status">${esc(rs.join('；'))}。以下只供原表對照。</p>`:''}<div class="promo-amount">${o.tiers.length?(tiers.length?tiers.map(t=>esc(t.label)+' '+money(t.amount)).join('<br>'):'此條件無適用級距'):money(o.amount)}</div><small>${rs.length?'原表金額':'單項最高折價'}｜${esc(o.start&&o.end?o.start+'～'+o.end:'原表未載活動期間，受理前須確認')}</small><p>${esc(o.condition)}</p>${o.tiers.length?`<details><summary>全部資費／約期級距</summary>${o.tiers.map(t=>`<p>${esc(t.label)}：${money(t.amount)}</p>`).join('')}</details>`:''}${o.combos.length?'<p><b>原表組合總額（已含單項，不重複相加）</b></p>'+o.combos.map(t=>`<div class="nov-combo ${comboReason(t,q)||rs.length?'nov-unmatched':''}"><b>${esc(t.label)}：${money(t.amount)}</b><p>${esc(t.condition)}${comboReason(t,q)?'（不符目前篩選）':''}</p><small>專案代碼 ${esc(t.code)}</small></div>`).join(''):''}${o.note?'<p>'+esc(o.note)+'</p>':''}<details><summary>專案代碼與完整條件</summary>${o.codes.map(t=>'<p><code>'+esc(t.code)+'</code> '+esc(t.label)+'</p>').join('')||'<p>原表未列專案代碼</p>'}</details><button type="button" class="promo-source-link" data-promo-source="NOV-${esc(o.id)}">對照11月原表 ↗</button></article>`;
  }
  function answer(q,targets=[]){
   let models=data.models.filter(m=>q.intent==='code'?m.offers.some(o=>o.codes.some(c=>c.code===q.code)||o.combos.some(c=>c.code===q.code)):targets.some(t=>t.key===bundle.modelKeys[m.id]||t.id===bundle.modelKeys[m.id]));
   const all=models;
   models=models.filter(m=>{const n=(m.spec.match(/\d+/g)||[]).map(Number);return !n.length||(!q.ram||n[0]===q.ram)&&(!q.storage||n[1]===q.storage);});
   if(!models.length)return '<h3>11月促案快查</h3><p>'+ (all.length?'本表未列此RAM／容量的活動，請確認完整規格。':'請輸入完整機型或專案代碼，例如「X500 12/512 舊換新」。')+'</p>';
   let categories=q.categories||[];if(q.loyalAmbiguous)categories=categories.map(c=>c==='loyal'?'home':c);
   const sections=models.map(m=>{const offers=m.offers.filter(o=>q.intent==='code'?o.codes.some(c=>c.code===q.code)||o.combos.some(c=>c.code===q.code):!categories.length||categories.some(c=>cat[c]===o.category));return offers.length?'<h4>'+esc(m.brand+' '+m.name+' '+m.spec)+'</h4>'+offers.map(o=>card(m.id,o.id,q)).join(''):'';}).join('');
   return '<h3>11月促案｜'+esc(q.intent==='code'?'專案代碼 '+q.code:targets.map(t=>t.label).join('、'))+'</h3><p>依11月原表顯示單項折價與已列明的組合總額；未列的組合不自行相加，價格表不再扣價。</p>'+(q.rates?.length>1||q.months?.length>1?'<p>目前選擇多個資費／約期，以下分列原表條件，請逐筆確認。</p>':'')+(sections||'<p>本機型未列所選類別的優惠，請查看其他活動。</p>')+'<p><button type="button" class="small" data-nov-open>開啟11月機型快查／異動／完整規則</button></p>';
  }
  function openSource(id){const s=bundle.pack.sources.find(s=>s.id===id);if(!s)return;let d=document.getElementById('novemberSourceDialog');if(!d){d=document.createElement('dialog');d.id='novemberSourceDialog';d.innerHTML='<div class="cardhead"><h2></h2><button type="button" data-nov-close>關閉</button></div><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:20px;font:15px/1.8 system-ui"></pre>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();}d.querySelector('h2').textContent=s.title;d.querySelector('pre').textContent=s.text;d.showModal();}
  function openLookup(){window.activate('november');document.getElementById('cayaClose')?.click();}
  function finish(){
   const originalActivate=window.activate;window.activate=function(tab){if(tab==='november'){document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id==='pane-november'));document.querySelectorAll('.nav button').forEach(p=>p.classList.toggle('active',p.dataset.tab===tab));document.getElementById('ratePanel').hidden=true;let f=document.getElementById('novemberLookupFrame');if(!f.dataset.loaded){f.srcdoc=bundle.lookupHtml;f.dataset.loaded='true';}}else originalActivate(tab);};
   document.querySelector('[data-tab="november"]').addEventListener('click',()=>window.activate('november'));
   document.addEventListener('click',e=>{if(e.target.closest('[data-nov-open]'))openLookup();});
  }
  window.cayaNovember={modelKey,ruleCard:card,answer,openSource,finish};
 }
 function swap(text,before,after){if(!text.includes(before))throw Error('促案整合格式不相容，已停止載入，避免沿用舊促案。');return text.replace(before,after);}
 window.cayaApplyNovember=function(html,bundle){
  if(bundle?.schema!=='caya-november/1'||bundle.month!=='2026-11'||bundle.data.models.length!==62||bundle.pack.rules.length!==115)throw Error('11月促案資料不完整，請重新載入。');
  const doc=new DOMParser().parseFromString(html,'text/html'),seed=doc.getElementById('seed')?.textContent;
  if(!seed||!doc.getElementById('promotionData'))throw Error('未找到查價工作台來源資料。');
  const currentPack=JSON.parse(doc.getElementById('promotionData').textContent);
  // Do not overwrite a later month's independently published promotions.
  if(currentPack.period>bundle.month)return html;
  doc.getElementById('promotionData').textContent=JSON.stringify(bundle.pack).replace(/</g,'\\u003c');
  for(const s of doc.querySelectorAll('script:not([src])')){
   if(s.type==='application/json')continue;let code=s.textContent;
   if(code.includes('function createPromotionEngine(db)')){
    code=swap(code,'return {key,ram,storage,blocked,special};','return {key:blocked?null:(window.cayaNovember.modelKey(raw)||key),ram,storage,blocked,special};');
    code=swap(code,'function validate(pack){',"function validate(pack){if(pack.referenceOnly){if(pack.period!=='2026-11'||!Array.isArray(pack.rules)||!pack.rules.length||!Array.isArray(pack.sources)||!pack.sources.every(s=>typeof s.text==='string'))throw Error('11月促案包格式錯誤');return true;}");
    code=code.replace('；10月不沿用','；本月不沿用');
   }
   if(code.includes('function ruleCard(e){')){
    code=swap(code,'function ruleCard(e){','function ruleCard(e){if(pack.referenceOnly)return window.cayaNovember.ruleCard(e.rule.novModel,e.rule.novOffer,getContext());');
    code=swap(code,'function openSource(id){','function openSource(id){if(pack.referenceOnly){window.cayaNovember.openSource(id);return;}');
    code=swap(code,"$('promoSourceLibrary').innerHTML=pack.sources.map(s=>", "$('promoSourceLibrary').innerHTML=pack.referenceOnly?'<p>完整原表與逐項對照已收錄於11月促案快查。</p><button type=\"button\" data-nov-open>開啟11月完整規則</button>':pack.sources.map(s=>");
   }
   if(code.includes('function promoAnswer(q){')){
    code=swap(code,'function promoAnswer(q){','function promoAnswer(q){if(pack().referenceOnly)return window.cayaNovember.answer(q,targetInfo(q));');
    code=swap(code,'function codeAnswer(q){','function codeAnswer(q){if(pack().referenceOnly)return window.cayaNovember.answer(q);');
    code=swap(code,'function announcementCombos(key,q,requested=[],expand=true){','function announcementCombos(key,q,requested=[],expand=true){if(pack().referenceOnly)return [];');
    code=code.replace('2026/10/23','2026/11/02');
   }
   s.textContent=code;
  }
  const bootstrap=doc.createElement('script');bootstrap.id='novemberRuntime';bootstrap.textContent='('+runtime.toString()+')('+JSON.stringify(bundle).replace(/</g,'\\u003c')+');';doc.head.append(bootstrap);
  doc.querySelector('.topline h1').textContent='手機價格 × 11月促案';doc.title='北一二C｜手機價格 × 11月促案';
  doc.getElementById('promoDate').setAttribute('value','2026-11-01');
  doc.getElementById('promotionHeading').previousElementSibling.textContent='2026 NOVEMBER · PROMOTION CHECK';
  const nav=doc.querySelector('#nav'),button=doc.createElement('button');button.type='button';button.dataset.tab='november';button.innerHTML='<span>★</span>11月促案快查';nav.insertBefore(button,nav.querySelector('[data-tab="promos"]'));
  const oldNav=nav.querySelector('[data-tab="promos"]');oldNav.innerHTML='<span>07</span>11月促案規則庫';
  const pane=doc.createElement('section');pane.id='pane-november';pane.className='pane';pane.innerHTML='<iframe id="novemberLookupFrame" title="11月促案機型快查" sandbox="allow-scripts allow-same-origin allow-downloads allow-modals" style="width:100%;height:calc(100dvh - 160px);min-height:650px;border:0;border-radius:16px;background:#fff"></iframe>';doc.querySelector('.workspace').append(pane);
  const style=doc.createElement('style');style.textContent='.nov-offer p{font-size:14px;line-height:1.8}.nov-combo{padding:10px;margin:8px 0;background:#edf5f2;border-radius:8px}.nov-unmatched{opacity:.65}.nov-status{color:#9e3535}#novemberSourceDialog{width:min(950px,94vw);max-height:90dvh;border:1px solid #abc9c1;border-radius:14px}#promotionPanel>.cardbody>.promo-context,#promotionPanel .promo-eligibility,#promotionPanel .promo-stack-expand,#promoCombos,#promoImportant,#clearPromoCustomer{display:none!important}';doc.head.append(style);
  const note=doc.querySelector('#promotionPanel .promo-safe-note');if(note)note.textContent='11月促案參考表：以下列出單項折價、適用條件與原表組合總額；價格表數字不自動再扣優惠。';
  const end=doc.createElement('script');end.textContent='window.cayaNovember.finish();';doc.body.append(end);
  if(seed!==doc.getElementById('seed').textContent)throw Error('原價格資料保留檢查失敗。');
  return '<!doctype html>\n'+doc.documentElement.outerHTML;
 };
})();

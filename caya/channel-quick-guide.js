'use strict';
/* CAYA 6.8: one-page OP / SMG / CBG quick guide for November 2026.
   This is a presentation layer only. It does not rewrite prices, login data,
   workbook bytes, or the authenticated promotion payload. */
(() => {
  const prior = window.cayaApplyNovember;
  if (typeof prior !== 'function') throw Error('請先載入11月促案模組。');

  const STYLE = String.raw`
  #pane-channel-guide{padding:0!important}
  .qg-wrap{max-width:1480px;margin:0 auto;padding:22px 22px 48px}
  .qg-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:22px 24px;border-radius:18px;background:linear-gradient(135deg,#0b655e,#178f7f);color:#fff;box-shadow:0 8px 22px #0b574c24}
  .qg-hero h2{font-size:30px;line-height:1.15;margin:4px 0 8px;color:#fff}
  .qg-hero p{margin:0;color:#e9fffa;font-size:14px}
  .qg-kicker{font-size:11px;letter-spacing:2px;font-weight:800;color:#c6fff1}
  .qg-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  .qg-actions button{background:#fff;color:#0c6259;border:0}
  .qg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px}
  .qg-card{background:#fff;border:1px solid #d8e6e0;border-radius:16px;overflow:hidden;box-shadow:0 5px 15px #163b3a0b}
  .qg-card-head{padding:16px 18px 13px;border-bottom:1px solid #e4ece8}
  .qg-card-head strong{display:block;font-size:23px;line-height:1.15}
  .qg-card-head small{display:block;margin-top:4px;color:#6c7e78}
  .qg-card.op .qg-card-head{background:linear-gradient(135deg,#fff3de,#fffaf1)}
  .qg-card.smg .qg-card-head{background:linear-gradient(135deg,#eaf1ff,#f7f9ff)}
  .qg-card.cbg .qg-card-head{background:linear-gradient(135deg,#e7f8f2,#f5fcf9)}
  .qg-list{padding:10px 16px 16px}
  .qg-item{padding:12px 4px;border-bottom:1px dashed #dce7e2}
  .qg-item:last-child{border-bottom:0}
  .qg-item b{display:block;font-size:15px;color:#173d3a}
  .qg-item p{margin:4px 0 0;font-size:13px;line-height:1.65;color:#536b64}
  .qg-tag{display:inline-block;font-size:11px;font-weight:800;border-radius:999px;padding:2px 7px;margin-right:6px;background:#eaf4f0;color:#27665d}
  .qg-warn{background:#fff8e8;border:1px solid #efd49a;color:#77551e;border-radius:12px;padding:11px 13px;margin-top:12px;font-size:12px;line-height:1.7}
  .qg-rule{margin-top:16px;background:#fff;border:1px solid #d8e6e0;border-radius:16px;padding:16px 18px}
  .qg-rule h3{margin:0 0 8px;font-size:18px}
  .qg-rule-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .qg-mini{padding:11px 12px;border-radius:11px;background:#f4f8f6;font-size:12px;line-height:1.6}
  .qg-mini b{display:block;font-size:13px;margin-bottom:2px}
  .qg-footer{margin-top:14px;color:#61766f;font-size:11px;line-height:1.7;text-align:center}
  @media(max-width:1050px){.qg-grid{grid-template-columns:1fr}.qg-rule-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.qg-hero{align-items:flex-start;flex-direction:column}.qg-actions{justify-content:flex-start}}
  @media(max-width:620px){.qg-wrap{padding:14px 12px 34px}.qg-hero{padding:18px}.qg-hero h2{font-size:25px}.qg-rule-grid{grid-template-columns:1fr}.qg-card-head strong{font-size:21px}}
  `;

  const HTML = String.raw`
  <div class="qg-wrap">
    <section class="qg-hero">
      <div>
        <div class="qg-kicker">NOVEMBER · ONE PAGE QUICK GUIDE</div>
        <h2>OP／SMG／CBG 一頁速讀</h2>
        <p>先看「能賣什麼、誰能辦、哪裡不能疊」，再進查價或11月促案快查確認完整條件。</p>
      </div>
      <div class="qg-actions">
        <button type="button" data-qg-target="search">手機快速查價</button>
        <button type="button" data-qg-target="november">11月促案快查</button>
      </div>
    </section>

    <div class="qg-grid">
      <section class="qg-card op">
        <div class="qg-card-head"><strong>OP 系列</strong><small>手機不一定要換，也能從生活情境切入</small></div>
        <div class="qg-list">
          <div class="qg-item"><b><span class="qg-tag">影音</span>OP 影音劇院</b><p>從追劇、大螢幕、串流體驗切入；搭配現行 OP 料號清單查商品與組合，不自行延用下架品。</p></div>
          <div class="qg-item"><b><span class="qg-tag">娛樂</span>OP 遊戲玩家</b><p>遊戲、周邊與娛樂設備需求優先詢問；先問使用情境，再用 OP 商品清單確認可搭品項。</p></div>
          <div class="qg-item"><b><span class="qg-tag">居家</span>OP 智慧家庭</b><p>家用網路、智慧設備、路由與居家情境一起談，適合「手機暫時不換」的客戶延伸提案。</p></div>
          <div class="qg-item"><b><span class="qg-tag">科技</span>OP 科技生活</b><p>AI／穿戴／3C 科技生活商品可做第二需求；商品、上架與可搭專案仍以當期 OP 料號為準。</p></div>
          <div class="qg-item"><b><span class="qg-tag">充電</span>MyCharge 充電多</b><p>5G 999／24個月：每月充電金 $200，24個月最高 $4,800，充電 95 折；須用申辦門號註冊 USPACE。</p></div>
          <div class="qg-warn"><b>OP 提醒：</b>先找生活需求，不要只問「要不要換手機」。查到商品後仍須核對上／下架、申辦資格及通路限制。</div>
        </div>
      </section>

      <section class="qg-card smg">
        <div class="qg-card-head"><strong>SMG</strong><small>員眷／指定方案與合作優惠限制要先看</small></div>
        <div class="qg-list">
          <div class="qg-item"><b><span class="qg-tag">兒錶</span>myFirst Fone S3 SE</b><p>4G 24月：199型 $2,990／398型 $990；4G 30月：199型 $1,990／398型 $0。</p></div>
          <div class="qg-item"><b><span class="qg-tag">SMG員眷</span>499型／30月 $0</b><p>需符合 SMG 員眷資格；原稿未列本購機價起迄日，報價前要再核對系統／公告。</p></div>
          <div class="qg-item"><b><span class="qg-tag">限制</span>UGO／USPACE 機場接送</b><p>企客／SMG 不適用。不要因為客戶是 5G 就直接承諾可領。</p></div>
          <div class="qg-item"><b><span class="qg-tag">限制</span>WeMo 智慧移動合作案</b><p>4G／5G 申辦禮及既有 5G 用戶禮均標示「企客／SMG 不適用」；進店禮另依門市活動規則。</p></div>
          <div class="qg-warn"><b>SMG 提醒：</b>先確認是不是 SMG／員眷資格，再看可搭專案；合作優惠有「SMG 不適用」時，不可照一般客戶規則承諾。</div>
        </div>
      </section>

      <section class="qg-card cbg">
        <div class="qg-card-head"><strong>CBG</strong><small>11月手機促案主戰區：購機、升轉、舊換新、老客戶</small></div>
        <div class="qg-list">
          <div class="qg-item"><b><span class="qg-tag">Pixel</span>Pixel 11 系列 RT／4升5</b><p>5G CBG：1399↑ 折 $4,000；999／1199 折 $1,000；未滿999折 $1,000。RT 升轉與 4升5 擇一，企客／精選T排除。</p></div>
          <div class="qg-item"><b><span class="qg-tag">Samsung</span>S26／S26+／S26 Ultra</b><p>S26 新增升轉；5G CBG 1399↑ 折 $2,000，活動至 11/30。可併符合資格舊換新，不可併老客戶折價。</p></div>
          <div class="qg-item"><b><span class="qg-tag">老客戶</span>vivo X500</b><p>12G/256G、12G/512G：特維用戶＋租期5年以上，續約 5G CBG 48個月折 $2,000。</p></div>
          <div class="qg-item"><b><span class="qg-tag">Apple</span>iPhone 18／Duo／Mac</b><p>租期5年以上：續約 5G CBG 1399H↑ 可依約期升 VIP；升轉續約 999H↑ 另有 mo幣 $500～$1,500，須依資格與方案核對。</p></div>
          <div class="qg-item"><b><span class="qg-tag">舊換新</span>11月依機款差異</b><p>多數 AQ／NP／RT 指定 5G CBG 可搭舊換新，但金額、是否可疊老客戶與 FE 屬性依機款不同，必須進「11月促案快查」。</p></div>
          <div class="qg-warn"><b>CBG 提醒：</b>「CBG」不是看到折價就全加。先確認資費、約期、AQ／NP／RT、是否企客／精選T，再確認舊換新／老客戶／升轉能否併用。</div>
        </div>
      </section>
    </div>

    <section class="qg-rule">
      <h3>門市 4 步快判</h3>
      <div class="qg-rule-grid">
        <div class="qg-mini"><b>① 先分客群</b>一般／SMG／企客／特維／老客戶，先分清楚再報優惠。</div>
        <div class="qg-mini"><b>② 再選主需求</b>換手機走 CBG；不換手機就從 OP 影音、居家、科技、充電切入。</div>
        <div class="qg-mini"><b>③ 看資費與約期</b>同一機型不同 999／1399、30／36／48 月，優惠可能完全不同。</div>
        <div class="qg-mini"><b>④ 最後查併用</b>升轉／4升5、舊換新、老客戶不是一律可疊；以促案快查與系統資格為準。</div>
      </div>
    </section>

    <div class="qg-footer">2026/11 門市內部速讀｜價格、活動期間、FE 資格與實際可辦狀態仍以當期系統／正式公告為準。</div>
  </div>`;

  window.cayaApplyNovember = function(html, bundle) {
    const base = prior(html, bundle);
    if (bundle?.month !== '2026-11') return base;
    const doc = new DOMParser().parseFromString(base, 'text/html');
    if (doc.getElementById('pane-channel-guide')) return base;

    const nav = doc.getElementById('nav');
    const workspace = doc.querySelector('.workspace');
    if (!nav || !workspace) throw Error('CAYA 導覽結構已變更，OP／SMG／CBG速讀頁未加入。');

    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.dataset.tab = 'channel-guide';
    btn.innerHTML = '<span>◎</span>OP／SMG／CBG速讀';
    const novemberBtn = nav.querySelector('[data-tab="november"]');
    nav.insertBefore(btn, novemberBtn || nav.firstChild);

    const pane = doc.createElement('section');
    pane.id = 'pane-channel-guide';
    pane.className = 'pane';
    pane.innerHTML = HTML;
    workspace.append(pane);

    const style = doc.createElement('style');
    style.id = 'cayaChannelGuideStyle';
    style.textContent = STYLE;
    doc.head.append(style);

    const runtime = doc.createElement('script');
    runtime.id = 'cayaChannelGuideRuntime';
    runtime.textContent = `
      (()=>{const old=window.activate;
        window.activate=function(tab){
          if(tab==='channel-guide'){
            document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('active',p.id==='pane-channel-guide'));
            document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
            const rp=document.getElementById('ratePanel'); if(rp) rp.hidden=true; return;
          }
          old(tab);
        };
        const b=document.querySelector('[data-tab="channel-guide"]'); if(b)b.addEventListener('click',()=>window.activate('channel-guide'));
        document.addEventListener('click',e=>{const t=e.target.closest('[data-qg-target]');if(!t)return;window.activate(t.dataset.qgTarget);});
      })();
    `;
    doc.body.append(runtime);
    doc.documentElement.dataset.cayaQuickGuide = '6.8';
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  };
  window.cayaChannelGuideVersion = '6.8';
})();
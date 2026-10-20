/* N12C high-resolution screenshot boards. No credentials, raw workbook, or customer data exported.
 * Draw text again at target resolution; do not upscale an existing screenshot.
 * This module only reads the authenticated app state. It never writes to the API.
 */
(()=>{'use strict';
const W=1920,H=1080,P={ink:'#1e303b',muted:'#526977',accent:'#bb4e14',teal:'#173b40',bg:'#f4f7f8',line:'#dfe6e9',soft:'#fff2e6',red:'#b52e42',green:'#14705f',white:'#ffffff'};
const FONT='"Microsoft JhengHei","PingFang TC","Noto Sans CJK TC",sans-serif';
const titles={plan:'區聚焦計畫',overview:'九店獎金總覽',store:'單店手機追分'};
let drawing=false,seq=0,downloadURL=null;
const css=document.createElement('style');css.textContent=`
.sh-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.sh-open{background:#173b40;color:white;border-color:#173b40}
#shotDialog{width:min(1560px,calc(100% - 24px));padding:22px;max-height:96vh}#shotDialog .sh-top{display:flex;gap:15px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}#shotDialog h2{font-size:25px}#shotDialog .sh-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}#shotDialog label{font-size:15px;display:flex;gap:7px;align-items:center;margin:0}#shotDialog select{font-size:15px;padding:8px}#shotDialog .sh-stage{background:#e1e8ed;padding:10px;border-radius:12px;overflow:auto}#shotCanvas{display:block;width:100%;height:auto;aspect-ratio:16/9;background:white;border-radius:5px}#shotDialog .sh-bottom{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;margin-top:14px}#shotDialog .sh-note{font-size:14px;color:#526977;line-height:1.6}#shotStatus{min-height:24px;font-size:14px;color:#526977;margin:9px 0 0}#shotImageLink{color:#176171}#shotDialog.sh-large{width:calc(100% - 20px);max-width:none}#shotDialog.sh-large #shotCanvas{min-width:1100px}.sh-sr{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
@media(max-width:600px){#shotDialog{padding:14px}#shotDialog h2{font-size:22px}#shotDialog .sh-tools{gap:10px}#shotDialog .sh-stage{padding:4px}#shotDialog label{font-size:14px;max-width:100%}#shotDialog select{max-width:230px}#shotDialog .sh-bottom button{flex:1}.sh-actions{margin-top:12px}.sh-actions button{font-size:14px}}
`;document.head.append(css);
const heading=document.querySelector('#app .heading');if(!heading)return;
const actions=document.createElement('div');actions.className='sh-actions';heading.append(actions);actions.append(document.getElementById('copyPlan'));
const open=document.createElement('button');open.id='screenshotButton';open.className='sh-open';open.textContent='截圖清晰版';open.type='button';actions.prepend(open);
const dialog=document.createElement('dialog');dialog.id='shotDialog';dialog.setAttribute('aria-labelledby','shotTitle');dialog.innerHTML=`<div class="sh-top"><div><h2 id="shotTitle">截圖清晰版</h2><p class="sh-note">一張一個重點，直接產生16:9大字PNG，不用截長圖。</p></div><button id="shotClose" type="button" aria-label="關閉截圖版">關閉 ×</button></div><div class="sh-tools"><label>內容<select id="shotType"><option value="plan">區聚焦計畫</option><option value="overview">九店獎金總覽</option><option value="store">單店手機追分</option></select></label><label id="shotStoreWrap" hidden>門市<select id="shotStore"></select></label><label>畫質<select id="shotResolution"><option value="2">4K・3840 × 2160</option><option value="4">8K・7680 × 4320</option></select></label><button type="button" id="shotZoom">放大檢視</button></div><div class="sh-stage"><canvas id="shotCanvas" width="1920" height="1080" role="img" aria-label="台獎清晰看板預覽"></canvas></div><div class="sh-bottom"><p class="sh-note">計畫與實績分開；圖片保留資料截至日、版本與口徑。<br>僅限內部分享，不包含登入密碼；下載後的圖片不會自動更新。</p><button id="shotDownload" class="primary" type="button">下載清晰PNG</button></div><p id="shotStatus" role="status" aria-live="polite"></p><a id="shotImageLink" hidden target="_blank" rel="noopener">開啟原圖（手機可長按儲存）</a>`;
document.body.append(dialog);const el=id=>document.getElementById(id);const ctx=el('shotCanvas').getContext('2d');
function snapshot(){if(document.getElementById('app').hidden||!D||!PLAN||!state)throw Error('請先登入並載入共用資料。');return JSON.parse(JSON.stringify({defs:D,plan:PLAN,state,revision}));}
function fmt(n){return typeof n==='number'&&Number.isFinite(n)?'$'+n.toLocaleString('zh-TW',{maximumFractionDigits:2}):'未提供';}
function record(s,i){const r=s.state.report?.[i];return r&&r.asOf===s.state.asOf?r:null;}
function total(a){return a.reduce((v,n)=>v+(Number.isFinite(n)?n:0),0);}
function draw(canvas,s,type,store,scale=1){canvas.width=W*scale;canvas.height=H*scale;const c=canvas.getContext('2d');if(!c)throw Error('瀏覽器無法建立圖片，請改用4K。');c.setTransform(scale,0,0,scale,0,0);c.textBaseline='top';
 const logs=[];const text=(str,x,y,size=26,color=P.ink,weight=500,max=1792,align='left')=>{str=String(str??'');c.font=`${weight} ${size}px ${FONT}`;let f=size;while(c.measureText(str).width>max&&f>18){f--;c.font=`${weight} ${f}px ${FONT}`;}const measured=c.measureText(str).width;if(measured>max)throw Error('文字超出圖片欄寬，請縮短機款或來源文字。');c.fillStyle=color;c.textAlign=align;c.fillText(str,x,y);logs.push({text:str,x,y,font:f,width:measured});};
 const box=(x,y,w,h,fill=P.white,r=16,border=null)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(border){c.strokeStyle=border;c.lineWidth=1.4;c.stroke();}};
 const line=(x,y,w,color=P.line)=>{c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.strokeStyle=color;c.lineWidth=1.3;c.stroke();};
 const note=(str,y=218,color=P.soft)=>{box(64,y,1792,60,color,12);text(str,86,y+16,25,P.accent,700,1748);};
 const validDate=/^2026-10-(0[1-9]|[12]\d|3[01])$/.test(s.state.asOf||'');
 const source=validDate?`資料截至 ${s.state.asOf} · 共用版本 ${s.revision}`:`截至日未確認 · 先前對帳資料（非今日實績）· 版本 ${s.revision}`;
 const label=type==='plan'?'原訂聚焦計畫 · 全區新增要求':source;
 c.fillStyle=P.bg;c.fillRect(0,0,W,H);box(0,0,W,194,P.teal,0);box(64,40,7,106,P.accent,3);
 text('北一二C  /  2026年10月台獎',91,37,22,'#c0d4d4',650);
 const title=type==='plan'?'A57、V80 Lite優先追｜四輪聚焦計畫':type==='overview'?'九店獎金總覽｜Excel原表對帳':`${s.defs.stores[store].name}｜手機差異與追分提醒`;
 text(title,91,79,44,P.white,800,1450);text(label,91,143,23,'#d8e5e5',500,1560);text('內部使用',1856,44,21,'#c0d4d4',600,210,'right');
 const footer=(one,two)=>{line(64,990,1792);text(one,64,1007,21,P.muted,500,1792);text(two,64,1040,19,P.muted,500,1600);text('AI CAYA',1856,1040,20,P.teal,750,180,'right');};
 if(type==='plan'){
  const rounds=s.plan.rounds;if(rounds.length!==4)throw Error('目前清晰版適用四輪計畫，請先確認計畫格式。');
  note(`原訂六組新增合計 ${total(rounds.map(r=>total(r.qty)))} 台｜全區要求，非每店台數；目標10/24完成，25日核對補缺。`);
  rounds.forEach((r,k)=>{const x=64+k*453,y=302,w=433;box(x,y,w,476,P.white,16,k<2?'#dfaf8e':P.line);box(x,y,w,76,k<2?P.teal:'#eaf0f2',16);text(r.label,x+22,y+16,22,k<2?'#cfe0df':P.muted,700,130);text(`10/${r.start}—${r.end}`,x+w-22,y+12,34,k<2?P.white:P.teal,800,210,'right');
   r.ids.forEach((j,i)=>{text(s.defs.models[j].name,x+22,y+100+i*51,29,P.ink,750,290);text(r.qty[i]+'台',x+w-22,y+98+i*51,34,P.accent,800,90,'right');});
   text('本輪新增',x+22,y+216,22,P.muted,600,200);text(total(r.qty)+'台',x+w-22,y+203,44,P.teal,800,150,'right');line(x+22,y+267,w-44);
   text('日期',x+22,y+284,20,P.muted,600,100);text('兩款台數（上列順序）',x+158,y+284,19,P.muted,500,210);r.daily.forEach((a,d)=>{text(`10/${r.start+d}`,x+22,y+323+d*44,23,P.ink,700,105);text(a.join('＋'),x+169,y+323+d*44,25,P.ink,700,130);text(total(a)+'台',x+w-22,y+323+d*44,26,P.accent,750,85,'right');});});
  box(64,797,1792,101,'#e7f0ee',14);text('三組同步跑',86,816,25,P.teal,800,200);text('A6x／A7 Pro：13～24日每天追',320,812,26,P.ink,750,660);text('Pixel 11、Pixel 11 Pro組：23日前補足100%',1008,812,26,P.ink,750,820);text('依最新缺口另外加每日需求；不包含在上列193台內，不能等輪到才開始。',320,855,24,P.muted,500,1480);
  text('開店：確認庫存與客戶名單　→　19:00追進度　→　打烊核對有效上線',64,923,28,P.ink,750,1792);
  footer('以上為原訂計畫，不是實績；提前成交扣減後續缺口，不重複加賣、不壓件、不轉掛。','區各組100%與每店獎金$11,000分開檢核；計畫不是成交或實領保證。');
 }else if(type==='overview'){
  const recs=ORDER.map(i=>record(s,i)),actual=recs.every(r=>typeof r?.actualBonus==='number')?total(recs.map(r=>r.actualBonus)):null,proj=recs.every(r=>typeof r?.projectedBonus==='number')?total(recs.map(r=>r.projectedBonus)):null;
  const xK=[64,672,1280];[['實際總獎金合計',fmt(actual)],['推估原始總獎金合計',fmt(proj)],['原表領獎Y（僅參考）',recs.filter(r=>r?.eligible==='Y').length+' / 9 店']].forEach((v,k)=>{box(xK[k],218,576,100,P.white,13,P.line);text(v[0],xK[k]+23,235,23,P.muted,650,525);text(v[1],xK[k]+23,269,36,k===1?P.accent:P.teal,800,525);});
  const xs=[64,430,760,1140,1505,1680,1856];box(64,342,1792,622,P.white,12);box(64,342,1792,70,P.teal,12);
  [['門市',88,450],['實際總獎金',728,295],['推估原始總獎金',1108,360],['推估距$11,000',1473,335],['排名',1648,135],['領獎參考',1834,160]].forEach((v,k)=>text(v[0],v[1],k===2?351:362,25,P.white,700,v[2],k===0?'left':'right'));text('不含排名權重獎金',1108,382,18,'#d8e5e5',500,350,'right');
  ORDER.forEach((i,k)=>{const r=record(s,i),y=412+k*61,g=r?.projectedBonus==null?null:Math.max(0,s.defs.goal-r.projectedBonus);if(k%2===0)box(64,y,1792,61,'#f6f9fa',0);if(r?.eligible==='N')box(64,y,1792,61,'#fff0f1',0);text(s.defs.stores[i].name,88,y+14,28,P.ink,750,320);text(fmt(r?.actualBonus),728,y+14,28,P.ink,650,290,'right');text(fmt(r?.projectedBonus),1108,y+14,30,P.teal,800,350,'right');text(g===0?'推估已達':fmt(g),1473,y+14,28,g===0?P.green:P.accent,750,325,'right');text(r?.rank??'未提供',1648,y+14,28,P.ink,600,130,'right');text(r?.eligible??'未提供',1810,y+14,28,r?.eligible==='N'?P.red:P.ink,800,130,'right');});
  footer('實際與推估不可互相替代；只有「推估距$11,000」另外計算，不用前9組小計取代原表總額。','Y／N為原表參考；同名次未依總KPI做第二排序，不代表最終核發。'+(!validDate?' 截至日未確認。':''));
 }else{
  const i=store,r=record(s,i),nums=s.state.actual[i],targets=s.state.targets[i],ready=validDate&&!!r&&nums.every(Number.isInteger);
  const next=(j)=>{const n=nums[j],t=targets[j];if(!ready)return null;const cut=[50,80,100,120,200].find(p=>n*100<t*p);if(cut===undefined)return null;const need=Math.ceil(t*cut/100),v=a=>{let b=0;[50,80,100,120,200].forEach((p,k)=>{if(a*100>=t*p)b=s.defs.models[j].manager[k];});return b;};return {j,n,t,cut,need,add:need-n,gain:v(need)-v(n)};};
  const vals=[['Excel實際總獎金',fmt(r?.actualBonus)],['Excel推估原始總獎金',fmt(r?.projectedBonus)],['推估距$11,000',r?.projectedBonus==null?'未提供':fmt(Math.max(0,s.defs.goal-r.projectedBonus))]];
  vals.forEach((v,k)=>{box(64+k*608,218,576,95,P.white,13,P.line);text(v[0],87+k*608,234,23,P.muted,600,530);text(v[1],87+k*608,269,33,k===2?P.accent:P.teal,800,530);});
  const tips=ready?s.defs.models.map((m,j)=>next(j)).filter(v=>v&&v.gain>0).sort((a,b)=>(a.n*100<a.t*50?0:1)-(b.n*100<b.t*50?0:1)||a.add-b.add||b.gain-a.gain).slice(0,3):[];
  if(tips.length){tips.forEach((t,k)=>{const x=64+k*608;box(x,333,576,139,P.soft,13);text(`優先${k+1}  ${s.defs.models[t.j].name} 再${t.add}台`,x+22,350,27,P.accent,800,530);text(`累計做到${t.need}台 → 跨${t.cut}%級距`,x+22,396,24,P.ink,650,530);text(`該組基礎獎金試算 ＋${fmt(t.gain)}（不加回原表）`,x+22,434,21,P.muted,500,530);});}
  else {box(64,333,1792,139,P.soft,13);text(ready?'九組已達最高表列級距，持續依顧客需求成交。':'截至日未確認或本店九組未齊，暫不產生補台建議。',87,360,30,P.accent,750,1725);text(ready?'其他原表品項、排名及領獎資格仍需另行核對。':'下表保留先前原值供核對；上傳完整同日Excel後，文字建議會同步更新。',87,414,25,P.muted,550,1725);}
  box(64,492,1792,480,P.white,12);box(64,492,1792,62,P.teal,12);
  const cols=[88,738,950,1180,1430,1832],headers=['競賽組','實際上線','月目標','累計達成率','原表推估率','距實際100%'];headers.forEach((t,k)=>text(t,cols[k],510,24,P.white,650,k===0?580:350,k===0?'left':'right'));
  s.defs.models.forEach((m,j)=>{const y=554+j*46,n=r?nums[j]:null,t=targets[j],rate=r?s.state.rates[i][j]:null;if(j%2===0)box(64,y,1792,46,'#f6f9fa',0);const values=[m.name,n??'未提供',t,n==null?'—':(n/t*100).toFixed(1)+'%',rate==null?'—':(rate*100).toFixed(1)+'%',n==null?'—':Math.max(0,t-n)+'台'];values.forEach((v,k)=>text(v,cols[k],y+10,24,k===5&&n<t?P.accent:P.ink,k===0||k===5?750:550,k===0?580:350,k===0?'left':'right'));});
  footer('手機增額是前9組獨立級距試算，不加回Excel推估總獎金；不含排名權數與空機，不保證實領。','每組先過店點50%門檻，再看跨級機會；是否來得及仍需核對庫存與客戶需求。');
 }
 canvas.dataset.texts=JSON.stringify(logs);canvas.setAttribute('aria-label',title+'。'+label);return canvas;
}
function resetLink(){if(downloadURL){URL.revokeObjectURL(downloadURL);downloadURL=null;}el('shotImageLink').hidden=true;el('shotImageLink').removeAttribute('href');}
async function preview(){const ticket=++seq;if(!dialog.open)return;try{drawing=true;el('shotDownload').disabled=true;el('shotStatus').textContent='正在產生清晰版…';resetLink();await document.fonts.ready;if(ticket!==seq||!dialog.open)return;const s=snapshot(),type=el('shotType').value;el('shotStoreWrap').hidden=type!=='store';draw(el('shotCanvas'),s,type,Number(el('shotStore').value),1);el('shotStatus').textContent=(type==='plan'?'原訂計畫；不是實際完成量。':s.state.asOf?'資料截至 '+s.state.asOf:'截至日未確認，圖片會保留警示。')+' 匯出畫質：'+el('shotResolution').selectedOptions[0].textContent;}
 catch(e){ctx.clearRect(0,0,W,H);el('shotStatus').textContent='無法產生：'+e.message;}finally{if(ticket===seq){drawing=false;el('shotDownload').disabled=document.getElementById('app').hidden;}}}
async function saveImage(){if(drawing)return;let canvas=null;const ticket=++seq;try{drawing=true;el('shotDownload').disabled=true;el('shotStatus').textContent='正在匯出原尺寸PNG…';await document.fonts.ready;const s=snapshot(),type=el('shotType').value,i=Number(el('shotStore').value),scale=Number(el('shotResolution').value);canvas=draw(document.createElement('canvas'),s,type,i,scale);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('圖片記憶體不足，請改選4K。')),'image/png'));if(ticket!==seq||!dialog.open||document.getElementById('app').hidden)return;resetLink();downloadURL=URL.createObjectURL(blob);const name='北一二C_10月台獎_'+titles[type]+(type==='store'?'_'+s.defs.stores[i].name:'')+'_'+(type==='plan'?'1013-1024原訂計畫':s.state.asOf||'截至日未確認')+'_'+(scale===4?'8K':'4K')+'.png';const a=document.createElement('a');a.href=downloadURL;a.download=name;a.click();el('shotImageLink').href=downloadURL;el('shotImageLink').hidden=false;el('shotStatus').textContent=`已產生 ${W*scale} × ${H*scale} PNG；手機未下載時，點「開啟原圖」長按儲存。`;}
 catch(e){el('shotStatus').textContent='匯出未完成：'+e.message;}finally{if(canvas){canvas.width=1;canvas.height=1;}drawing=false;el('shotDownload').disabled=document.getElementById('app').hidden;}}
function close(){++seq;dialog.close();dialog.classList.remove('sh-large');el('shotZoom').textContent='放大檢視';resetLink();ctx.clearRect(0,0,W,H);el('shotCanvas').removeAttribute('data-texts');el('shotStatus').textContent='';}
open.onclick=()=>{try{const s=snapshot(),sel=el('shotStore');sel.replaceChildren();ORDER.forEach(i=>{const opt=document.createElement('option');opt.value=i;opt.textContent=s.defs.stores[i].name;sel.append(opt);});sel.value=String(selected);dialog.showModal();preview();}catch(e){status(e.message,true);}};
el('shotClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});el('shotType').onchange=preview;el('shotStore').onchange=preview;el('shotResolution').onchange=preview;el('shotDownload').onclick=saveImage;el('shotZoom').onclick=()=>{dialog.classList.toggle('sh-large');el('shotZoom').textContent=dialog.classList.contains('sh-large')?'縮回預覽':'放大檢視';};
new MutationObserver(()=>{if(document.getElementById('app').hidden){if(dialog.open)close();}else if(dialog.open&&!drawing)preview();}).observe(document.getElementById('status'),{childList:true,subtree:true,characterData:true});
new MutationObserver(()=>{if(document.getElementById('app').hidden&&dialog.open)close();}).observe(document.getElementById('app'),{attributes:true,attributeFilter:['hidden']});
})();

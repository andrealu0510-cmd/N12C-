/* Live single-page bonus overview. Reads authenticated state only.
 * Never substitutes model subtotals for report totals and never publishes data.
 * Neither credentials nor account IDs are included in the PNG.
 */
(()=>{'use strict';
 const el=id=>document.getElementById(id),board=el('dailyBoard');if(!board)return;
 const formatter=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2});
 const finite=v=>typeof v==='number'&&Number.isFinite(v),fmt=v=>finite(v)?'$'+formatter.format(v):'未提供';
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let lastURL=null,exporting=false,ticket=0,queued=false;
 function active(){return !el('app').hidden&&typeof D!=='undefined'&&D&&state;}
 function snapshot(){if(!active())throw Error('請先登入並載入共用資料。');return JSON.parse(JSON.stringify({defs:D,state,revision}));}
 function values(s){return ORDER.map(i=>{const raw=s.state.report?.[i],r=raw&&raw.asOf===s.state.asOf?raw:null,p=r?.projectedBonus,gap=finite(p)?Math.max(0,s.defs.goal-p):null;return {name:s.defs.stores[i].name,actual:r?.actualBonus,projected:p,rank:r?.rank,eligible:r?.eligible,gap};});}
 function highlight(rows){const candidates=rows.filter(r=>r.eligible==='Y'&&r.gap!==null);return candidates.length?Math.min(...candidates.map(r=>r.gap)):null;}
 function dateLabel(s){return validDate(s.state.asOf)?'資料截至 '+s.state.asOf:'截至日未確認｜先前對帳資料，非今日實績';}
 function notices(s,rows){const notes=[];if(!validDate(s.state.asOf))notes.push('截至日尚未確認，請先發布最新Excel；不可視為今日實績。');const missing=rows.filter(r=>![r.actual,r.projected,r.rank].every(finite)||!['Y','N'].includes(r.eligible)).length;if(missing)notes.push(missing+'店欄位未齊或日期不同，保留「未提供」，不補0、不套用舊總額。');if(/暫時無法同步|服務暫時無法使用|未確認發布成功/.test(el('status').textContent))notes.push('共用同步尚未成功，畫面保留上次版本。');return notes;}
 function revoke(){if(lastURL){URL.revokeObjectURL(lastURL);lastURL=null;}el('onePageImageLink').hidden=true;el('onePageImageLink').removeAttribute('href');}
 function render(){queued=false;if(!active()){ticket++;revoke();el('dailyRows').replaceChildren();el('dailyDate').textContent='登入後讀取共用資料';el('dailyVersion').textContent='原表對帳';el('dailyWarning').textContent='';el('dailyWarning').hidden=true;el('onePageExportStatus').textContent='';document.body.classList.remove('daily-full');el('onePageFullscreen').textContent='全螢幕';return;}
  el('onePageUpload').hidden=session?.role!=='admin';const s=snapshot(),rows=values(s),nearest=highlight(rows),notes=notices(s,rows);
  el('dailyPeriod').textContent='N12C · '+s.defs.period.replace('-','年')+'月台獎';el('dailyGoal').textContent=fmt(s.defs.goal);
  el('dailyDate').textContent=dateLabel(s);el('dailyVersion').textContent='共用版本 '+s.revision+' · 原值保留';
  el('dailyWarning').textContent=notes.join(' ');el('dailyWarning').hidden=notes.length===0;
  el('dailyRows').innerHTML=rows.map(r=>{const near=nearest!==null&&r.eligible==='Y'&&(r.gap===0||r.gap===nearest),cls=r.eligible==='N'?'is-no':near?'is-nearest':'';return `<tr class="${cls}"><td>${safe(r.name)}</td><td class="${finite(r.actual)?'':'is-missing'}">${fmt(r.actual)}</td><td class="${finite(r.projected)?'':'is-missing'}">${fmt(r.projected)}</td><td class="gap ${r.gap===0?'is-zero':''} ${r.gap===null?'is-missing':''}">${r.gap===null?'未提供':r.gap===0?'推估已達':fmt(r.gap)}</td><td class="${finite(r.rank)?'':'is-missing'}">${finite(r.rank)?formatter.format(r.rank):'未提供'}</td><td class="${r.eligible?'':'is-missing'}">${safe(r.eligible||'未提供')}</td></tr>`;}).join('');
 }
 function queue(){if(!queued){queued=true;requestAnimationFrame(render);}}
 // Reuse existing app update events; no duplicate table fetch and no access-policy change.
 new MutationObserver(queue).observe(el('reports'),{childList:true,subtree:true});
 new MutationObserver(queue).observe(el('status'),{childList:true,subtree:true,characterData:true});
 new MutationObserver(queue).observe(el('app'),{attributes:true,attributeFilter:['hidden']});
 // Readers already poll in app.js. Admins also see other published revisions when not importing.
 setInterval(()=>{if(active()&&session?.role==='admin'&&!document.hidden&&!busy&&!pending)pull(true);},30000);
 document.addEventListener('visibilitychange',()=>{if(active()&&!document.hidden&&session?.role==='admin'&&!busy&&!pending)pull(true);});
 el('onePageUpload').onclick=()=>{if(active()&&session?.role==='admin')el('fileInput').click();};
 el('onePageFullscreen').onclick=()=>{if(!active())return;const yes=document.body.classList.toggle('daily-full');el('onePageFullscreen').textContent=yes?'返回一般頁面':'全螢幕';};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('daily-full')){document.body.classList.remove('daily-full');el('onePageFullscreen').textContent='全螢幕';}});
 function draw(canvas,s){
  const scale=2,W=1920,H=1080;canvas.width=W*scale;canvas.height=H*scale;const c=canvas.getContext('2d');if(!c)throw Error('瀏覽器無法建立圖片。');c.scale(scale,scale);c.textBaseline='top';
  const C={ink:'#13343f',muted:'#526e78',teal:'#144951',orange:'#c74616',green:'#107765',line:'#e4ebef'};
  const FONT='"Microsoft JhengHei","PingFang TC","Noto Sans CJK TC",sans-serif';
  const logs=[];function text(t,x,y,size,color=C.ink,weight=650,max=1800,align='left'){t=String(t??'');c.font=`${weight} ${size}px ${FONT}`;while(c.measureText(t).width>max&&size>16){size--;c.font=`${weight} ${size}px ${FONT}`;}if(c.measureText(t).width>max)throw Error('文字超出欄寬，未產生裁切圖片。');c.fillStyle=color;c.textAlign=align;c.fillText(t,x,y);logs.push(t);}
  function box(x,y,w,h,color,r=0){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=color;c.fill();}
  function line(x1,y1,x2,y2){c.strokeStyle=C.line;c.lineWidth=1;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
  const rows=values(s),near=highlight(rows),notes=notices(s,rows),warning=notes.join(' ');
  box(0,0,W,H,'#ffffff');box(26,25,8,114,'#ee6b20',3);text('北一二C｜九店獎金一頁總覽',52,30,52,C.teal,850,1230);text(dateLabel(s),53,99,25,validDate(s.state.asOf)?C.muted:'#9a5214',650,1220);
  box(1310,22,280,120,'#fff5ea',14);text('每店金額管理目標',1332,39,23,C.muted,600,236);text(fmt(s.defs.goal),1332,75,44,C.orange,850,236);
  box(1606,22,288,120,'#edf5f6',14);text('原表金額與排名',1629,39,23,C.muted,600,242);text('保留原值',1629,79,37,C.teal,850,242);
  box(26,158,1868,66,C.teal,12);box(44,174,7,34,'#ee6b20',3);text('九店獎金總覽｜Excel原表對帳',69,174,35,'#fff',850,1430);text('共用版本 '+s.revision,1868,181,23,'#d6e8e8',600,240,'right');
  let y=235;if(warning){box(26,y,1868,37,'#fff1df');text(warning,44,y+7,20,'#884608',650,1825);y+=46;}
  const widths=[355,318,392,392,187,224],edges=[26];for(const w of widths)edges.push(edges.at(-1)+w);
  const headerH=79,rowH=warning?70:75;box(26,y,1868,headerH,'#e7f0f3',5);
  const headers=[['門市',''],['實際總獎金','Excel原值'],['推估原始總獎金','不含排名權重獎金'],['推估距$11,000','尚差金額，非實際差額'],['排名','原表名次'],['原表領獎','僅供參考']];
  headers.forEach((h,k)=>{const x=k===0?edges[k]+24:k===5?(edges[k]+edges[k+1])/2:edges[k+1]-25,align=k===0?'left':k===5?'center':'right';text(h[0],x,y+12,30,C.ink,850,widths[k]-42,align);if(h[1])text(h[1],x,y+51,19,C.muted,500,widths[k]-42,align);});
  y+=headerH;rows.forEach((r,k)=>{const nearest=near!==null&&r.eligible==='Y'&&(r.gap===0||r.gap===near);box(26,y,1868,rowH,r.eligible==='N'?'#ffedf0':nearest?'#ddf5ee':k%2?'#f5f9fb':'#fff');const vals=[r.name,fmt(r.actual),fmt(r.projected),r.gap===null?'未提供':r.gap===0?'推估已達':fmt(r.gap),finite(r.rank)?formatter.format(r.rank):'未提供',r.eligible||'未提供'];vals.forEach((v,j)=>{const x=j===0?edges[j]+24:j===5?(edges[j]+edges[j+1])/2:edges[j+1]-25,color=j===3?(nearest||r.gap===0?C.green:C.orange):j===5&&r.eligible==='N'?'#bf2039':j===2?C.teal:C.ink;text(v,x,y+(rowH-46)/2,39,color,j===0||j===2||j===3||j===5?850:650,widths[j]-43,j===0?'left':j===5?'center':'right');});line(26,y+rowH,1894,y+rowH);y+=rowH;});
  box(26,1003,1868,60,'#fff8f0',10);text('紅底：原表N需追蹤｜綠底：推估最接近／已達金額目標｜只有推估差額另行計算，實際與推估不混算。',44,1012,22,'#a24b1b',700,1820);
  text('Y／N同名次未依總KPI二次排序，僅供參考；區100%不等於每店可領$11,000。本圖為當次資料快照，僅限內部使用。',44,1040,18,C.muted,550,1820);
  canvas.dataset.texts=JSON.stringify(logs);return canvas;
 }
 el('onePageDownload').onclick=async()=>{if(exporting)return;let canvas=null;const mine=++ticket;try{exporting=true;el('onePageDownload').disabled=true;el('onePageExportStatus').textContent='正在產生本頁4K清晰圖…';await document.fonts.ready;const s=snapshot();canvas=draw(document.createElement('canvas'),s);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('圖片產生失敗，請重試。')),'image/png'));if(mine!==ticket||!active())return;revoke();lastURL=URL.createObjectURL(blob);const a=document.createElement('a');a.href=lastURL;a.download='北一二C_九店獎金一頁版_'+(s.state.asOf||'截至日未確認')+'_v'+s.revision+'_4K.png';a.click();el('onePageImageLink').href=lastURL;el('onePageImageLink').hidden=false;el('onePageExportStatus').textContent='已產生3840 × 2160 PNG。圖片是本次快照，下次發布後請重新下載。';}catch(e){el('onePageExportStatus').textContent='匯出未完成：'+e.message;}finally{exporting=false;el('onePageDownload').disabled=false;if(canvas){canvas.width=1;canvas.height=1;}}};
 render();
})();

'use strict';
/* CAYA 6.5: show every source version in separate columns.
   No quoted value, workbook byte, source coordinate or promotion is rewritten. */
(() => {
 const prior=window.cayaPrepareWorkspace;
 if(typeof prior!=='function')throw Error('請先載入商品與容量檢核程式。');
 const INIT=String.raw`function initFamilies(wanted){
 const all=availableQuotes(),qs=all.filter(q=>String(q.plan.sheet)===el('matrixProject').value);
 const fs=uniq(qs.map(q=>familyMap.get(q.plan))).map(k=>families.get(k)).filter(Boolean).sort((a,b)=>familyScore(b,qs)-familyScore(a,qs));
 const allKey='all-versions:'+el('matrixProject').value;
 if(fs.length){const h=fs[0].h;families.set(allKey,{key:allKey,allVersions:true,h:{...h,group:'本專案全部版本',variant:'全部版本（分欄）',services:uniq(fs.flatMap(f=>f.h.services))},label:'全部版本（每欄保留原欄名與條件）',plans:uniq(qs.map(q=>q.plan))});}
 options('matrixFamily',[...(fs.length?[{value:allKey,label:'全部版本（一般／加碼／VIP分欄，不混價）'}]:[]),...fs.map(f=>({value:f.key,label:f.label+(fs.filter(g=>g.label===f.label).length>1?'｜原欄名 '+f.h.label:'')}))],wanted??allKey);
 renderProjectChoices(all);syncChoices();schedule(true);
}`;
 const BUILD=String.raw`function buildView(){allSource();const m=modelMap.get(el('matrixModel').value),f=families.get(el('matrixFamily').value);if(!m||!f)return null;
 const activePlans=f.plans,qs=availableQuotes().filter(q=>f.allVersions?String(q.plan.sheet)===el('matrixProject').value:familyMap.get(q.plan)===f.key);
 const rates=selectedRateValues(),months=selectedMonthValues();
 const columns=[];for(const month of months)for(const rate of rates){
  const plans=activePlans.filter(h=>h.months===month&&h.rate===rate);
  const versions=new Map();for(const h of plans){const k=familyMap.get(h);if(!versions.has(k))versions.set(k,[]);versions.get(k).push(h);}
  for(const [familyKey,group] of versions)columns.push({month,rate,plans:group,key:month+'|'+rate+'|'+familyKey});
 }
 const sourceRows=groupedProductRows(m.products).sort((a,b)=>specScore(b.products[0])-specScore(a.products[0])||a.products[0].sku.localeCompare(b.products[0].sku));
 const bySKU=new Map();for(const q of qs){if(!bySKU.has(q.product.sku))bySKU.set(q.product.sku,[]);bySKU.get(q.product.sku).push(q);}
 const rows=sourceRows.map((row,i)=>{const p=row.products[0],all=bySKU.get(p.sku)||[];return {...row,index:i,product:p,spec:rowSpec(p),values:columns.map(c=>all.filter(q=>c.plans.includes(q.plan)))};});
 return {model:m,family:f,rows,columns,quotes:qs,sourceRows};
}`;
 const COLUMN=String.raw` const columnHtml=columns.map(c=>{const h=c.plans[0];return '<th scope="col" title="'+esc(h.group+'｜'+h.label+'｜'+h.variant+'｜'+h.services.join('／'))+'">'+(c.month==null?'期數未明示':c.month+'期')+'<br><span class="mx-source-label">'+esc(h.label||'資費未明示')+'</span><small class="mx-source-variant">'+esc(h.variant)+'</small></th>';}).join('');`;
 const NOTICE=String.raw` const allKey='all-versions:'+el('matrixProject').value;
 if(!f.allVersions){
  const other=availableQuotes().filter(q=>String(q.plan.sheet)===el('matrixProject').value&&Number.isFinite(q.price)&&selectedRateValues().includes(q.plan.rate)&&selectedMonthValues().includes(q.plan.months)&&familyMap.get(q.plan)!==f.key);
  const vs=uniq(other.map(q=>q.plan.variant));
  if(other.length){el('matrixContent').insertAdjacentHTML('afterbegin','<div class="mx-version-notice"><b>相同期數／資費，其他版本也有數字價格：</b>'+esc(vs.join('、'))+'。本表只看目前版本，空白不代表其他版本沒有價格。 <button type="button" class="small primary" id="matrixShowAllVersions">全部版本分欄查看</button></div>');el('matrixShowAllVersions').onclick=()=>{el('matrixFamily').value=allKey;syncChoices();schedule(true);};}
 }
`;
 const STYLE=String.raw`
 #matrixTable th .mx-source-label{display:block;white-space:normal;overflow-wrap:anywhere;font-size:12px;line-height:1.35;margin-top:3px}
 #matrixTable th .mx-source-variant{display:block;white-space:normal;font-size:10px;line-height:1.25;margin-top:3px;color:inherit;opacity:.92}
 #matrixTable thead th{min-width:90px;vertical-align:middle}
 .mx-version-notice{border:1px solid #d8c38d;background:#fff8e7;color:#705326;border-radius:9px;padding:11px;font-size:12px;line-height:1.65;margin:12px 0}
 .mx-version-notice button{margin-top:6px}
 `;
 function once(text,before,after){if(text.split(before).length-1!==1)throw Error('價格表版本不相容：未套用全版本檢核。');return text.replace(before,()=>after);}
 function section(text,start,next,replacement){const a=text.indexOf(start),b=text.indexOf(next,a+start.length);if(a<0||b<0||text.indexOf(start,a+start.length)!==-1)throw Error('價格表函式版本不相容，未變更來源。');return text.slice(0,a)+replacement+'\n'+text.slice(b);}
 window.cayaPrepareWorkspace=function(html){
  const doc=new DOMParser().parseFromString(prior(html),'text/html');
  const seed=doc.getElementById('seed')?.textContent,promo=doc.getElementById('promotionData')?.textContent;
  const scripts=[...doc.querySelectorAll('script:not([src])')].filter(s=>s.type!=='application/json'&&s.textContent.includes('window.matrixDesk=')&&s.textContent.includes('function buildView(){'));
  if(scripts.length!==1)throw Error('找不到唯一橫向價格表，停止套用版本修正。');
  const script=scripts[0];let text=script.textContent;
  if(!text.includes('/* caya-versions-6.5 */')){
   text=section(text,'function initFamilies(wanted){','const choiceValue=',INIT);
   text=section(text,'function buildView(){','function cellState(',BUILD);
   text=section(text,' const columnHtml=',' const body=rows.map(',COLUMN);
   text=once(text," const bannerTitle=f.h.kind===", " const bannerTitle=f.allVersions?'各版本方案價參考':f.h.kind===");
   text=once(text," el('matrixTable').style.minWidth=", NOTICE+" el('matrixTable').style.minWidth=");
   text=once(text,"...view.columns.map(c=>c.rate===null?(c.plans[0]?.label||'原欄位未明示'):(c.month??'未明示')+'期 / '+c.rate+'資費')", "...view.columns.map(c=>(c.month??'未明示')+'期 / '+(c.plans[0]?.label||'原欄位未明示')+' / '+c.plans[0].variant+' / '+c.plans[0].group)");
   text=once(text,"version:'6.1',sourceUnchanged:true", "version:'6.5',sourceUnchanged:true");
   script.textContent='/* caya-versions-6.5 */\n'+text;
  }
  doc.getElementById('cayaAllVersionsStyle')?.remove();const style=doc.createElement('style');style.id='cayaAllVersionsStyle';style.textContent=STYLE;doc.head.append(style);
  doc.documentElement.dataset.cayaVersions='6.5';
  if(seed!==doc.getElementById('seed')?.textContent||promo!==doc.getElementById('promotionData')?.textContent)throw Error('原始資料保留檢查失敗。');
  return '<!doctype html>\n'+doc.documentElement.outerHTML;
 };
 window.cayaAllVersionsVersion='6.5';
})();

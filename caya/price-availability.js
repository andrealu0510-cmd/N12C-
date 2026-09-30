'use strict';
/* CAYA 6.5: expose separately labelled source-version prices beside blank cells.
   No workbook bytes, price records, promotion rules, or eligibility are changed. */
(() => {
  const VERSION = '6.5-version-prices';
  const previousPrepare = window.cayaPrepareWorkspace;
  if (typeof previousPrepare !== 'function') throw Error('請先載入工作台檢核程式。');
  const STYLE = `
    #matrixTable .mx-version-cell{min-width:104px;padding:8px 6px;vertical-align:top}
    #matrixTable .mx-version-empty{display:block;font-size:10px;font-weight:500;line-height:1.45;color:#6b7b86;margin-bottom:5px;white-space:normal}
    #matrixTable .mx-version-price{display:flex;flex-direction:column;align-items:center;gap:1px;width:100%;min-width:86px;min-height:47px;padding:5px 6px;margin:4px 0;border:1px solid #bfd9e7;border-radius:7px;background:#f3faff;color:#153f5c;white-space:nowrap;box-shadow:none}
    #matrixTable .mx-version-price span{font-size:10px;font-weight:700;line-height:1.45}
    #matrixTable .mx-version-price b{font-size:16px;font-variant-numeric:tabular-nums;line-height:1.3}
    #matrixTable .mx-version-price small{font-size:9px;font-weight:400;line-height:1.3;color:#5a7587}
    #matrixAlternateNotice{margin:0 0 12px;padding:11px 13px;border:1px solid #bad9ea;border-left:4px solid #0877b6;border-radius:9px;background:#eff8fe;color:#1f506b;font-size:12px;line-height:1.7}
    #matrixAlternateNotice b{display:block;font-size:14px;margin-bottom:3px}
    @media print{#matrixTable .mx-version-price{border-color:#aab4ba;background:#fff}#matrixTable .mx-version-price b{font-size:11pt}#matrixAlternateNotice{font-size:9pt}}
  `;
  const HELPERS = String.raw`
/* caya-version-prices-6.5 */
let versionPriceData=null,versionPriceIndex=new Map();
function samePriceContext(h){
 // Only explicit suffix versions of exactly the same source group/term/rate.
 // Never join another project, service, kind, or a different raw label formula.
 const label=n(h.label).toUpperCase().replace(/_(?:VIP加碼版|VIP|加碼版)$/,'');
 return JSON.stringify([h.sheet,n(h.group),h.kind,h.services.slice().sort(),h.months,h.rate,label]);
}
function ensureVersionPriceIndex(){
 if(versionPriceData===data)return;
 versionPriceData=data;versionPriceIndex=new Map();
 for(const q of data.quotes){
  if(q.status!=='numeric'||!Number.isFinite(q.price))continue;
  const key=JSON.stringify([q.product.sku,samePriceContext(q.plan)]);
  if(!versionPriceIndex.has(key))versionPriceIndex.set(key,[]);
  versionPriceIndex.get(key).push(q);
 }
}
function otherVersionQuotes(row,column){
 ensureVersionPriceIndex();
 const found=new Map();
 for(const h of column.plans){
  if(h.rate===null||h.months===null)continue;
  const key=JSON.stringify([row.product.sku,samePriceContext(h)]);
  for(const q of versionPriceIndex.get(key)||[]){
   if(column.plans.includes(q.plan)||q.plan.variant===h.variant)continue;
   found.set(q.id,q);
  }
 }
 const rank={'一般':0,'加碼':1,'VIP':2,'VIP＋加碼':3};
 return [...found.values()].sort((a,b)=>(rank[a.plan.variant]??9)-(rank[b.plan.variant]??9)||a.plan.col-b.plan.col);
}
function otherVersionCell(row,column,primary){
 const choices=otherVersionQuotes(row,column);
 if(!choices.length)return '';
 const current=column.plans[0]?.variant||view.family.h.variant;
 return '<td class="mx-empty mx-version-cell"><span class="mx-version-empty">'+esc(current)+'版：'+(cellState(primary)==='blank'?'原表空白':'本料號未列')+'</span>'+choices.map(q=>{
  const source=data.sheets[q.plan.sheet].name+'!'+q.cell;
  const label=q.plan.variant.endsWith('版')?q.plan.variant:q.plan.variant+'版';
  return '<button type="button" class="mx-version-price" data-mx-quote="'+esc(q.id)+'" data-source-cell="'+esc(q.cell)+'" title="'+esc(q.product.name+'｜'+q.plan.group+'｜'+q.plan.label+'｜'+source)+'"><span>'+esc(label)+'</span><b>'+fmt(q.price)+'</b><small>'+esc(q.cell)+' · 點價核對條件</small></button>';
 }).join('')+'</td>';
}
function visibleOtherVersions(){
 if(!view)return [];
 const out=[];
 for(const row of view.rows)row.values.forEach((primary,i)=>{
  const state=cellState(primary);
  if(state!=='blank'&&state!=='missing')return;
  for(const q of otherVersionQuotes(row,view.columns[i]))out.push({row,column:view.columns[i],quote:q});
 });
 return out;
}
function showOtherVersionNotice(){
 const count=visibleOtherVersions().length;
 if(count){
  const strip=el('matrixContent').querySelector('.mx-strip');if(strip)strip.innerHTML='主欄版本：<strong>'+esc(view.family.label)+'</strong>。空白格中的其他版本各自標示，不共用資格、不混價。';
  el('matrixContent').insertAdjacentHTML('afterbegin','<div id="matrixAlternateNotice" role="status"><b>原表有其他版本價格，已在空白格內另列</b>所選「'+esc(view.family.h.variant)+'」版的空白仍保留；下方「加碼／VIP」各筆金額都來自另一個原始欄位，須另核對資格，不能當成一般版或直接再扣優惠。</div>');
 }
 return count;
}
`;
  function replaceOnce(text,before,after){
    if(text.split(after).length-1===1)return text;
    if(text.split(before).length-1!==1)throw Error('價格表格式已改變，版本價格提醒未能套用；請更新相容版本。');
    return text.replace(before,()=>after);
  }
  function prepare(html){
    const prior=previousPrepare(html),doc=new DOMParser().parseFromString(prior,'text/html');
    const seed=doc.getElementById('seed')?.textContent,promos=doc.getElementById('promotionData')?.textContent;
    const scripts=[...doc.querySelectorAll('script:not([src])')].filter(s=>s.type!=='application/json');
    const matrix=scripts.filter(s=>s.textContent.includes('window.matrixDesk=')&&s.textContent.includes('function buildView(){'));
    if(matrix.length!==1)throw Error('找不到唯一的橫向表程式，未變更資料。');
    let code=matrix[0].textContent;
    if(!code.includes('/* caya-version-prices-6.5 */')){
      code=replaceOnce(code,'function buildView(){',HELPERS+'\nfunction buildView(){');
      const old="if(state==='missing'||state==='blank')return '<td class=\"mx-empty\" title=\"'+(state==='missing'?'原表未列此方案欄位或料號':'原表空白，不是0元')+'\">'+esc(label)+'</td>';";
      const next="if(state==='missing'||state==='blank')return otherVersionCell(r,columns[i],qs)||'<td class=\"mx-empty\" title=\"'+(state==='missing'?'原表未列此方案欄位或料號':'原表空白，不是0元')+'\">'+esc(label)+'</td>';";
      code=replaceOnce(code,old,next);
      code=replaceOnce(code,"if(columns.length&&!numeric)el('matrixContent')", "const otherVersionCount=showOtherVersionNotice();if(columns.length&&!numeric&&!otherVersionCount)el('matrixContent')");
      code=replaceOnce(code,'function tableRows(){','function baseTableRows(){');
      const EXPORT = String.raw`
function tableRows(){
 const rows=baseTableRows(),others=visibleOtherVersions();
 if(!others.length)return rows;
 return [...rows,[],['其他版本另列','以下不是所選版本的價格，需另外核對資格'],['規格','期數','資費','完整原欄名','版本','原表價','來源料號','原始格位'],...others.map(({row,column,quote:q})=>[row.spec,column.month,column.rate,q.plan.label,q.plan.variant,q.price,q.product.sku,data.sheets[q.plan.sheet].name+'!'+q.cell])];
}
`;
      code=replaceOnce(code,'async function copyTable(){',EXPORT+'\nasync function copyTable(){');
      code=replaceOnce(code,'window.matrixDesk={getView:',"window.matrixDesk={getOtherVersionPrices:visibleOtherVersions,otherVersionQuotes,samePriceContext,versionAvailability:'6.5',getView:");
      matrix[0].textContent=code;
    }
    let style=doc.getElementById('cayaVersionPriceStyle');if(!style){style=doc.createElement('style');style.id='cayaVersionPriceStyle';doc.head.appendChild(style);}style.textContent=STYLE;
    doc.documentElement.dataset.cayaVersionPrices=VERSION;
    if(seed!==doc.getElementById('seed')?.textContent||promos!==doc.getElementById('promotionData')?.textContent)throw Error('來源資料保留檢查失敗，未變更工作台。');
    return '<!doctype html>\n'+doc.documentElement.outerHTML;
  }
  window.cayaPrepareWorkspace=prepare;
  window.cayaPriceAvailabilityVersion=VERSION;
})();

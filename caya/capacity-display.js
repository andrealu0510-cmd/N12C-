'use strict';
/* CAYA 6.4: restore the complete RAM/storage label in the horizontal table.
   Source workbook, quote objects, pricing and promotions remain unchanged.
   This runs only after the existing authenticated release verification/filter. */
(() => {
  const VERSION = '6.4-capacity';
  const previousPrepare = window.cayaPrepareWorkspace;
  if (typeof previousPrepare !== 'function') throw Error('容量顯示修正需先載入商品篩選程式。');
  const STYLE = `
    #matrixTable tbody th[scope="row"]{white-space:normal!important;overflow:visible!important;line-height:1.35}
    #matrixTable .mx-spec-storage{display:block;font-size:16px;font-weight:850;color:#183245;line-height:1.35;white-space:nowrap}
    #matrixTable .mx-spec-ram{display:block;font-size:11px;font-weight:600;color:#526e7e;line-height:1.4;white-space:nowrap;margin-top:3px}
    #matrixTable .mx-spec-full{display:block;white-space:normal;overflow-wrap:anywhere;line-height:1.4}
    #matrixTable tbody th small{white-space:normal;overflow-wrap:anywhere}
    @media(max-width:760px){#matrixTable .mx-spec-storage{font-size:15px}#matrixTable .mx-spec-ram{font-size:11px}}
    @media print{#matrixTable .mx-spec-storage{font-size:11pt}#matrixTable .mx-spec-ram{font-size:8pt}}
  `;
  const FUNCTIONS = String.raw`/* caya-capacity-6.4 */
function rowSpec(p){
 const tail=n(p.name).split('_').slice(1).join('_');
 // Longest unit first: matching G before GB consumed only "12G" and skipped /256GB.
 const spec=tail.match(/^(\d+(?:\.\d+)?\s*(?:GB|TB|G|T))(?![A-Z0-9])(?:\s*\/\s*(\d+(?:\.\d+)?\s*(?:GB|TB|G|T))(?![A-Z0-9]))?/i);
 if(spec){
  // Do not silently collapse a malformed two-part spec into its first number.
  if(!spec[2]&&/^\s*\//.test(tail.slice(spec[0].length)))return '規格請核對原始料號';
  const unit=s=>s.toUpperCase().replace(/\s/g,'').replace(/G$/,'GB').replace(/T$/,'TB');
  return spec[2]?unit(spec[1])+' / '+unit(spec[2]):unit(spec[1]);
 }
 return p.capacity||'依原料號';
}
function rowSpecHtml(p){
 const spec=rowSpec(p),parts=spec.match(/^(\d+(?:\.\d+)?GB) \/ (\d+(?:\.\d+)?(?:GB|TB))$/);
 if(parts&&parseFloat(parts[1])<=64&&(parts[2].endsWith('TB')||parseFloat(parts[2])>=parseFloat(parts[1])))
  return '<span class="mx-spec-storage" title="'+esc(spec)+'">'+esc(parts[2])+'</span><span class="mx-spec-ram">記憶體 '+esc(parts[1])+'</span>';
 return '<span class="mx-spec-full">'+esc(spec)+'</span>';
}`;
  function exactlyOnce(text, before, after) {
    if (text.split(after).length - 1 === 1) return text;
    if (text.split(before).length - 1 !== 1) throw Error('橫向價格表格式已變更，容量修正未能套用；請更新相容版本。');
    return text.replace(before, after);
  }
  function prepare(html) {
    const filtered = previousPrepare(html);
    const doc = new DOMParser().parseFromString(filtered, 'text/html');
    const seed = doc.getElementById('seed')?.textContent;
    const promotions = doc.getElementById('promotionData')?.textContent;
    const scripts = [...doc.querySelectorAll('script:not([src])')].filter(s=>s.type!=='application/json');
    const matches = scripts.filter(s=>s.textContent.includes('function rowSpec(p){')&&s.textContent.includes('window.matrixDesk='));
    if(matches.length!==1)throw Error('未找到唯一的橫向價格表，容量顯示修正未能套用。');
    const script=matches[0];let code=script.textContent;
    if(!code.includes('/* caya-capacity-6.4 */')){
      const original=code.match(/^function rowSpec\(p\)\{[^\r\n]*\}$/gm)||[];
      if(original.length!==1)throw Error('容量顯示格式不相容，請更新工作台。');
      code=code.replace(original[0],()=>FUNCTIONS);
      code=exactlyOnce(code,"'<tr><th scope=\"row\">'+esc(r.spec)+meta+'", "'<tr><th scope=\"row\" aria-label=\"'+esc(r.spec)+'\">'+rowSpecHtml(p)+meta+'");
      script.textContent=code;
    }
    let style=doc.getElementById('cayaCapacityStyle');
    if(!style){style=doc.createElement('style');style.id='cayaCapacityStyle';doc.head.appendChild(style);}
    style.textContent=STYLE;
    doc.documentElement.dataset.cayaCapacity=VERSION;
    if(seed!==doc.getElementById('seed')?.textContent||promotions!==doc.getElementById('promotionData')?.textContent)throw Error('原始價格／促案保留檢查失敗。');
    return '<!doctype html>\n'+doc.documentElement.outerHTML;
  }
  window.cayaPrepareWorkspace=prepare;
  window.cayaCapacityPolicyVersion=VERSION;
})();

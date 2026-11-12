/* Small runtime correction layer for the November self-entry estimator. */
(function(root){'use strict';
const num=v=>Math.max(0,Number(v)||0);root.n=num;
const N=root.NRewards;if(!N||typeof N.calculate!=='function')return;const original=N.calculate,AQ=N.aq;
function tierIndex(area,total){if(area==='KT')return total>=5?2:total>=3?1:0;return total>=3?2:total>=2?1:0;}
N.calculate=function(state,phoneBase){state=state||N.emptyState();const out=original(state,phoneBase),rows=Array.isArray(state.aqRows)?state.aqRows:[],totals={KT:0,TBC:0,TOP:0,HP:0};
 for(const r of rows){if(totals[r.area]===undefined)continue;const half=r.half===true||String(r.half)==='true';totals[r.area]+=num(r.qty)*(half?0.5:1);}
 let aqBase=0,kt1gCount=0;for(const r of rows){const table=AQ[r.area]?.bands?.[r.band]?.[Number(r.term)||24];if(!table)continue;const half=r.half===true||String(r.half)==='true',factor=half?0.5:1;aqBase+=table[tierIndex(r.area,totals[r.area])]*num(r.qty)*factor;if(r.area==='KT'&&r.band==='1G')kt1gCount+=num(r.qty);}
 aqBase+=45*num(state.aqDtv);for(const area of Object.keys(totals))aqBase+=AQ[area].catv*num(state.aqCatv?.[area]);aqBase+=55*num(state.ktNoContractCatv);const top=totals.TOP;aqBase+=top>=5?200:top>=4?150:top>=3?100:0;
 let rt=0;for(const r of Array.isArray(state.rtRows)?state.rtRows:[]){const qty=num(r.qty);let add=0;if(r.mode==='chengshuang')add=55*Math.max(0,(Number(r.newMobile)||0)-(Number(r.oldMobile)||0));else if(r.mode==='addon')add=25*(Math.max(0,(Number(r.newMobile)||0)-(Number(r.oldMobile)||0))+Math.max(0,(Number(r.newBB)||0)-(Number(r.oldBB)||0)));rt+=(23+add+(r.kt3g?175:0))*qty;}
 const replacement=aqBase+rt,cat=out.categories.find(x=>x.id==='goodSpeed'),old=cat?.amount||0,diff=replacement-old;if(cat)cat.amount=replacement;out.other+=diff;if(typeof out.phone==='number'){out.total=out.phone+out.other;out.withConditional=out.total+out.conditional;}out.details.areaTotals=totals;out.details.aqBase=aqBase;out.details.rt=rt;out.details.topAdd=top>=5?200:top>=4?150:top>=3?100:0;out.details.kt1gCount=kt1gCount;return out;};
})(window);

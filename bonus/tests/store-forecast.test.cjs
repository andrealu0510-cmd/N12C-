const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../store-forecast-core.js');
const prices = [100, 200, 300, 400, 500];
function fixture() {
  return {defs: {period:'2026-11',stores:[{id:'STORE',name:'測試店'}],models:[{id:'m',name:'測試機款',manager:prices}]},state:{period:'2026-11',asOf:'2026-11-06',rowDates:['2026-11-06'],actual:[[2]],targets:[[10]],rates:[[1]],origins:[['report']],report:{0:{asOf:'2026-11-06',actualBonus:10,projectedBonus:999,eligible:'N'}}}};
}
function run(f=fixture(), inputs={}) { return C.simulate(f.defs,f.state,'STORE',inputs,'2026-11-07'); }
test('zero input decreases projection as time advances; official total remains untouched', () => {
  const f=fixture(),before=JSON.stringify(f),r=run(f);
  assert.equal(r.baselineAmount,300); assert.equal(r.forecastAmount,200); assert.equal(r.delta,-100);
  assert.equal(r.timeEffect,-100); assert.equal(r.inputEffect,0);
  assert.equal(r.report.projectedBonus,999); assert.equal(r.report.eligible,'N');
  assert.equal(r.inputDate,'2026-11-07'); assert.equal(r.reportDate,'2026-11-08');assert.equal(r.elapsed,7);
  assert.equal(JSON.stringify(f),before);
});
test('positive sales can still reduce the subtotal',()=>{
  const f=fixture();f.state.actual=[[4]];f.state.targets=[[20]];f.state.asOf='2026-11-01';f.state.rowDates=['2026-11-01'];f.state.rates=[[6]];
  // A below-top case: day 6, baseline 12/50*5 = 120%, then 13/50*30/7 = 111.43%.
  f.state.asOf='2026-11-06';f.state.rowDates=['2026-11-06'];f.state.actual=[[12]];f.state.targets=[[50]];f.state.rates=[[1.2]];
  const r=run(f,{m:{added:1,removed:0}});assert.equal(r.net,1);assert.equal(r.delta,-100);assert.equal(r.forecastAmount,300);
});
test('new units raise tiers and removals can reduce all the way to zero',()=>{
  let r=run(undefined,{m:{added:3,removed:0}});assert.equal(r.forecastAmount,500);assert.equal(r.delta,200);
  r=run(undefined,{m:{added:0,removed:2}});assert.equal(r.forecastAmount,0);assert.equal(r.delta,-300);
  r=run(undefined,{m:{added:1,removed:1}});assert.equal(r.net,0);assert.equal(r.forecastAmount,200);
});
test('both components reconcile to signed difference',()=>{
  for(let a=0;a<8;a++)for(let d=0;d<=2+a;d++){const r=run(undefined,{m:{added:a,removed:d}});assert.equal(r.complete,true);assert.equal(r.timeEffect+r.inputEffect,r.delta);assert.equal(r.forecastAmount-r.baselineAmount,r.delta);}
});
test('all tier cutoffs use integer comparisons, not rounded displayed rates',()=>{
  for(const [index,cut] of [50,80,100,120,200].entries()){
    assert.equal(C.tier(cut-1,100,30,30,prices).index,index-1);
    assert.equal(C.tier(cut,100,30,30,prices).index,index);
    assert.equal(C.tier(cut+1,100,30,30,prices).index,index);
  }
  assert.equal(C.tier(99999,100000,30,30,prices).index,1); // displays 100.00%, remains below 100%
  assert.equal(C.tier(6,7,30,30,prices).index,1);
});
test('empty, negative, decimal, enormous, NaN and infinite inputs block rather than clamp',()=>{
  for(const value of ['', ' ', '-1', '1.2', 'abc', '1e3', 100001, NaN, Infinity,null,true,false,{}]){
    const r=run(undefined,{m:{added:value,removed:0}});assert.equal(r.complete,false,String(value));assert.equal(r.forecastAmount,null);
  }
  assert.equal(run(undefined,{m:{added:0,removed:3}}).complete,false);
  assert.equal(run(undefined,{m:{added:1,removed:3}}).forecastAmount,0);
});
test('one incomplete group prevents a misleading total',()=>{
  const f=fixture();f.defs.models.push({id:'missing',name:'缺資料',manager:prices});
  const r=run(f);assert.equal(r.complete,false);assert.equal(r.forecastAmount,null);assert.equal(r.baselineAmount,null);
});
test('missing actual, zero target, provisional target and missing prices are blocked',()=>{
  for(const mutate of [f=>f.state.actual=[[null]],f=>f.state.targets=[[0]],f=>f.state.targets=[[null]],f=>f.state.origins=[['provisional']],f=>f.defs.models[0].manager=[1,2],f=>f.defs.models[0].manager=[1,2,3,4,NaN]]){
    const f=fixture();mutate(f);assert.equal(run(f).complete,false);
  }
});
test('reported four-decimal rate must reconcile; missing rates never pass',()=>{
  const f=fixture();f.state.targets=[[7]];f.state.rates=[[1.4286]];assert.equal(run(f).complete,true);
  for(const rate of [1.5,null,undefined,NaN,Infinity]){f.state.rates=[[rate]];assert.equal(run(f).complete,false);}
});
test('stale store row, stale shared date, wrong month and unknown store cannot forecast',()=>{
  for(const mutate of [f=>f.state.rowDates=['2026-11-05'],f=>f.state.asOf='2026-11-05',f=>f.state.period='2026-10',f=>f.defs.period='2026-10']){const f=fixture();mutate(f);assert.equal(run(f).complete,false);}
  const f=fixture();assert.equal(C.simulate(f.defs,f.state,'missing',{},'2026-11-07').complete,false);
});
test('month end uses final November day and rejects December inputs',()=>{
  const f=fixture();f.state.asOf='2026-11-29';f.state.rowDates=['2026-11-29'];f.state.rates=[[Number((2/10*30/29).toFixed(4))]];
  const r=C.simulate(f.defs,f.state,'STORE',{},'2026-11-30');assert.equal(r.complete,true);assert.equal(r.reportDate,'2026-12-01');assert.equal(r.elapsed,30);
  f.state.asOf='2026-11-30';f.state.rowDates=['2026-11-30'];f.state.rates=[[.2]];
  assert.equal(C.simulate(f.defs,f.state,'STORE',{},'2026-12-01').complete,false);
  assert.equal(C.dateParts('2026-11-31'),null);
});
test('raw official report with mismatched date is not displayed',()=>{const f=fixture();f.state.report[0].asOf='2026-11-05';assert.equal(run(f).report,null);});

test('empty payload and the first day of a new month never produce a cross-month forecast',()=>{
  const empty=C.simulate(null,null,'',{},'2026-11-07');assert.equal(empty.complete,false);assert.equal(empty.report,null);
  const f=fixture();f.state.asOf='2026-10-31';f.state.rowDates=['2026-10-31'];f.state.rates=[[.2]];
  assert.equal(C.simulate(f.defs,f.state,'STORE',{},'2026-11-01').complete,false);
});

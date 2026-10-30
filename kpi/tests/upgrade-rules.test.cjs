const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../upgrade-v20261007.js'), 'utf8');
const ITEMS = ['VK','Apple服務','影音(HBO/D+/Prime)','Netflix','空機/3C/物聯網/門市購','配件','包膜'];
const state = {stores: [], people: []};
const context = vm.createContext({window:{}, ITEMS, state, EXPECTED:[{store:'測試店'}],
  n:v=>v==null||v===''?null:Number(String(v).replace(/[% ,]/g,'')),
  clean:v=>Math.round(v*10)/10, storeMap:()=>Object.fromEntries(state.stores.map(x=>[x.store,x])),
  pct:v=>v==null?'—':v+'%', structuredClone});
const expose = ['score','evalStore','evalPerson','n12cRateColumns','n12cReadMetrics','metricClass','metricTd','n12cMetricRate','n12cTotals','n12cScoreRows'];
vm.runInContext(source.replace('window.n12cUpgradeHtml=upgradeHtml;', 'Object.assign(window,{'+expose.join(',')+'});window.n12cUpgradeHtml=upgradeHtml;'), context);
context.rateN=v=>v==null||v===''?null:String(v).includes('%')?context.n(v):Number(v)<=3?Number(v)*100:Number(v);
const app=context.window;
const baseline=()=>Object.fromEntries(ITEMS.map(k=>[k,100]));
test('Each requested boundary has the correct noncumulative deduction',()=>{
  const cases={
    VK:[[99.99,-.1],[100,0]], 'Apple服務':[[99.99,-.1],[100,0]],
    '影音(HBO/D+/Prime)':[[0,-.1],[69.99,-.1],[70,0]], Netflix:[[69.99,-.1],[70,0]],
    '空機/3C/物聯網/門市購':[[0,-.1],[49,-.1],[79.99,-.1],[80,0]],
    配件:[[0,-.2],[49.99,-.2],[50,-.1],[79.99,-.1],[80,0]],
    包膜:[[0,-.2],[49.99,-.2],[50,-.1],[79.99,-.1],[80,0]]
  };
  for(const [key,values]of Object.entries(cases))for(const [rate,expected]of values)assert.equal(app.score(rate,key),expected,`${key} ${rate}`);
  for(const key of ITEMS){assert.equal(app.score(110,key),0);assert.equal(app.score(110.01,key),.1);}
});
test('Missing/invalid values remain pending and unknown items do not score',()=>{
  for(const value of [null,undefined,'',' ',NaN,Infinity,'錯誤'])assert.equal(app.score(value,'VK'),null);
  assert.equal(app.score(0,'保險'),null);
  assert.equal(app.evalStore({metrics:{...baseline(),配件:null}}).total,null);
});
test('Store exemption applies only to negative scores and requires >100%',()=>{
  state.stores=[{store:'測試店',metrics:{...baseline(),配件:100,Netflix:101,VK:120}}];
  const p=app.evalPerson({store:'測試店',metrics:{...baseline(),配件:49,Netflix:69,VK:120}});
  assert.equal(p.items.find(i=>i.key==='配件').score,-.2);
  assert.equal(p.items.find(i=>i.key==='Netflix').score,0);
  assert.equal(p.items.find(i=>i.key==='Netflix').exempt,true);
  assert.equal(p.items.find(i=>i.key==='VK').score,.1);
  assert.equal(p.total,-.1);
  state.stores=[];
  assert.equal(app.evalPerson({store:'測試店',metrics:{...baseline(),配件:79}}).total,null);
  assert.equal(app.evalPerson({store:'測試店',metrics:baseline()}).total,0);
});
test('All-low total is -0.9, and red tiers follow the applicable item',()=>{
  assert.equal(app.evalStore({metrics:Object.fromEntries(ITEMS.map(k=>[k,0]))}).total,-.9);
  assert.equal(app.metricClass(49,'配件'),'bad2');
  assert.equal(app.metricClass(50,'配件'),'bad1');
  assert.equal(app.metricClass(79,'Netflix'),'');
  assert.equal(app.metricClass(79,'空機/3C/物聯網/門市購'),'bad1');
});
test('Legacy Apple/magazine source is counted once, and explicit missing Apple never falls back',()=>{
  const metrics=baseline();delete metrics['Apple服務'];metrics['天下/開通']=99;
  assert.equal(app.evalStore({metrics}).total,-.1);
  assert.equal(app.evalStore({metrics}).items.length,7);
  metrics['Apple服務']=null;
  assert.equal(app.evalStore({metrics}).total,null);
});
function fixture(kind, offset=0){
  const labels=['MyVideo&KKBOX','Apple&Google服務及雜誌週刊開通數','HBO Max&Disney+&Prime Video銷售數','Netflix多享組銷售數','空機、3C、物聯網及門市購營收','配件及其他營收','包膜與保貼營收'];
  const header=Array(8+offset).fill(''),leaf=[...header],data=[...header];
  data[offset]='測試店';
  if(kind==='105'){data[offset+1]='業務代表(I)';data[offset+2]='TEST001';data[offset+3]='測試員';}
  labels.forEach((label,i)=>{header.push(label,'','','');leaf.push('實際數','目標數','權重','進度達成率');data.push(9999,8888,1,`${[99,100,70,69,80,49,50][i]}%`);});
  return [['報表'],header,leaf,data];
}
test('010103/010105 map shifted four-column headers to rates, not revenue or targets',()=>{
  for(const kind of ['103','105'])for(const offset of [0,3]){
    const rows=fixture(kind,offset),rec={store:'測試店',empId:'TEST001',metrics:{}};
    const result=app.n12cReadMetrics(rows,[rec],kind)[0];
    assert.deepEqual(ITEMS.map(k=>result.metrics[k]),[99,100,70,69,80,49,50]);
    assert.equal(app.evalStore(result).total,-.5);
  }
});
test('New revenue column missing or ambiguous stays pending',()=>{
  const rows=fixture('103');rows[1][24]='其他不相關營收';
  const rec={store:'測試店',metrics:baseline()};
  app.n12cReadMetrics(rows,[rec],'103');
  assert.equal(rec.metrics['空機/3C/物聯網/門市購'],null);
  assert.equal(app.evalStore(rec).total,null);
  const duplicated=fixture('103');duplicated[1].push('空機、3C、物聯網及門市購營收','','','');duplicated[2].push('實際數','目標數','權重','進度達成率');
  assert.equal(app.n12cRateColumns(duplicated)['空機/3C/物聯網/門市購'],undefined);
});
if(process.env.N12C_TEMPLATE_PATH){
  test('Current protected template upgrades and all generated inline scripts compile',()=>{
    const html=app.n12cUpgradeHtml(fs.readFileSync(process.env.N12C_TEMPLATE_PATH,'utf8'));
    const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
    for(const script of scripts)new vm.Script(script);
    assert.ok(html.includes('一條龍7項'));
    assert.ok(!html.includes('附掛4項'));
    assert.ok(!html.includes('附掛6項'));
    assert.ok(!html.includes('規則：<100% -0.1'));
    const main=scripts.find(s=>s.includes('const ITEMS='));
    const declarations=main.slice(0,main.indexOf('\ndocument.querySelectorAll(".tab").forEach'));
    const live=vm.createContext({structuredClone,window:{}});
    vm.runInContext(declarations.replace(/const EXPECTED=.*?;\n/, 'const EXPECTED=[{store:"測試店"}];\n'),live);
    assert.equal(vm.runInContext('score(49,"配件")',live),-.2);
    assert.equal(vm.runInContext('ITEMS.length',live),7);
    for(const kind of ['103','105']) {
      const rows=fixture(kind,2);
      for(const label of ['AQ V+D 1399 (含)以上','RT V+D 1399 (含)以上','好速案銷售點數']) {
        rows[1].push(label,'','','');rows[2].push('實際數','目標數','權重','進度達成率');rows[3].push(1,1,1,'100%');
      }
      live.testRows=rows;
      const result=vm.runInContext(kind==='103'?'extractStores(testRows)':'extractPeople(testRows)',live);
      assert.equal(result.length,1);
      assert.deepEqual(ITEMS.map(k=>result[0].metrics[k]),[99,100,70,69,80,49,50]);
    }
    // A current full template must use the new parser wrappers, not just show new copy.
    assert.ok(vm.runInContext('extractPeople.toString().includes("n12cReadMetrics")',live));
    if(process.env.N12C_PREVIEW_PATH){
      const safe=html.replace(/const INITIAL=.*?;\nconst EXPECTED=.*?;\n/s,'const INITIAL={stores:[],people:[],date:"2026/10/30"};\nconst EXPECTED=[];\n');
      fs.writeFileSync(process.env.N12C_PREVIEW_PATH,safe);
    }
  });
}

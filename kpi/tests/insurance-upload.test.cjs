const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../upgrade-v20261007.js'),'utf8');
function setup(stores=['測試店']){
 const state={people:[{empId:'TEST001',store:stores[0]}]};
 const n=v=>v==null||v===''?null:Number(String(v).replace(/[% ,]/g,''));
 const context=vm.createContext({window:{},state,EXPECTED:stores.map(store=>({store})),n,rateN:v=>v==null||v===''?null:String(v).includes('%')?n(v):Number(v)<=3?Number(v)*100:Number(v)});
 vm.runInContext(source.replace('window.n12cUpgradeHtml=upgradeHtml;','Object.assign(window,{n12cInsuranceParse,n12cInsuranceRefresh,n12cDetectPeriod});window.n12cUpgradeHtml=upgradeHtml;'),context);
 return {app:context.window,state};
}
// Sanitized structure from the original 010508 BIFF workbook: no real sales rows.
function report(){
 const header=['','','手機保險銷售數','手機保險營收金額','手機保險銷售點數','手機保險目標數','進度達成率','手機保險搭售率','手機保險_月繳型_無預繳(目標搭售率:43%)','','','','手機保險_月繳型_預繳6M(目標搭售率:2%)','','','','手機保險_月繳型_預繳12M(目標搭售率:2%)','','','','手機保險_年繳型(目標搭售率:1%)'];
 const leaf=Array(8).fill('').concat(...Array(4).fill(['銷售數','營收金額','搭售率','搭售達成率']));
 return [['手機保險 KPI 進度達成率'],[],[],['區域'],[],header,leaf,['區域合計','',100,200,300,400,.9,.8],[],header.slice(),leaf.slice(),['TEST_STORE','測試店',10,200,30,40,.9,.449,5,100,.2,.5,2,40,.1,.5,2,40,.1,.5,1,20,.049,.5],['合計','',100,200,300,400,.9,.8]];
}
test('Official overall heading wins over four plan rates and repeated headers',()=>{
 const {app}=setup(),rows=report(),result=app.n12cInsuranceParse(rows,'010508');
 assert.equal(result.error,'');assert.equal(result.column,7);assert.equal(result.label,'手機保險搭售率');assert.equal(result.records.length,1);assert.equal(result.records[0].rate,44.9);
 assert.equal(app.n12cDetectPeriod(rows,'010508-20261031.xls').date,null);
});
test('Synthetic 010509 uses employee ID and the same exact overall heading',()=>{
 const {app}=setup();const rows=[['門市','員編','手機保險搭售率','月繳搭售率','年繳搭售率'],['測試店','TEST001','44.9%','40%','4.9%']];
 const r=app.n12cInsuranceParse(rows,'010509');assert.equal(r.records.length,1);assert.equal(r.records[0].key,'TEST001');assert.equal(r.records[0].rate,44.9);
});
test('Ambiguous overall columns fail closed, missing values stay missing',()=>{
 const {app}=setup();
 for(const header of [['手機保險搭售率','整體保險搭售率'],['手機保險搭售率','手機保險搭售率'],['月繳搭售率','年繳搭售率']])assert.equal(app.n12cInsuranceParse([['門市',...header],['測試店','.4','.5']],'010508').records.length,0);
 assert.equal(app.n12cInsuranceParse([['門市','手機保險搭售率'],['測試店','']],'010508').records[0].rate,null);
});
test('Date remains unconfirmed until explicit confirmation; saved rows are unchanged',()=>{
 const {app,state}=setup();state.rawUploads={'010508':{rows:report(),source:'010508-20261031.xls'}};const before=JSON.stringify(state.rawUploads);
 app.n12cInsuranceRefresh();assert.equal(state.insurance['010508'].date,null);assert.equal(JSON.stringify(state.rawUploads),before);
 state.rawUploads['010508'].confirmedDate='2026/10/30';app.n12cInsuranceRefresh();assert.equal(state.insurance['010508'].date,'2026/10/30');
});
if(process.env.N12C_REAL_508){test('Private real workbook rows all match column H, with nine stores only',()=>{
 const rows=JSON.parse(fs.readFileSync(process.env.N12C_REAL_508,'utf8')),stores=rows.slice(14,23).map(r=>r[1]);
 const {app}=setup(stores),r=app.n12cInsuranceParse(rows,'010508');assert.equal(r.column,7);assert.equal(r.records.length,9);
 for(const row of rows.slice(14,23))assert.equal(r.records.find(r=>r.key===row[1]).rate,row[7]*100);
 assert.equal(app.n12cDetectPeriod(rows,'010508.xls').date,null);
});}

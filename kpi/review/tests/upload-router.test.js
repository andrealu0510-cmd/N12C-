import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {classifyReportWorkbook} from '../upload-router.js';
const ctx={};vm.runInNewContext(readFileSync(new URL('../vendor/xlsx.full.min.js',import.meta.url),'utf8'),ctx);const X=ctx.XLSX;
function wb(kind='store',name='資料'){
 const prefix=kind==='personal'?['北一二C','DNB10002','台北忠孝東','店長','5510001','測*甲']:['北一二C','DNB10002','台北忠孝東'];
 const headers=prefix.map(()=>''),rows=[['202610','2026/10/01 ~ 10/31'],[...headers,'排名','總進度達成率','AQ V+D 999 (含)以上'],[...headers,'','','實際數','目標數','權重','進度達成率'],[...prefix,1,'85%',8,10,'10%','80%']];
 const sheet=X.utils.aoa_to_sheet(rows);return {SheetNames:[name],Sheets:{[name]:sheet}};
}
test('store workbook routes by identity rows even with renamed file and sheet',()=>assert.equal(classifyReportWorkbook(wb(),'renamed.xls',X).kind,'store'));
test('personal ID and job take priority over a misleading store filename',()=>assert.equal(classifyReportWorkbook(wb('personal'),'01-01-03.xlsx',X).kind,'personal'));
test('blank columns do not change store routing',()=>{const w=wb();const s=w.Sheets.資料;for(const a of Object.keys(s).filter(a=>/^[A-Z]+\d+$/.test(a)).reverse()){const pos=X.utils.decode_cell(a);if(pos.c>=1){s[X.utils.encode_cell({r:pos.r,c:pos.c+2})]=s[a];delete s[a];}}assert.equal(classifyReportWorkbook(w,'x.xls',X).kind,'store');});
test('workbook with both report types is blocked rather than silently partially saved',()=>{const s=wb(),p=wb('personal','個人');const w={SheetNames:['資料','個人'],Sheets:{...s.Sheets,...p.Sheets}};assert.equal(classifyReportWorkbook(w,'x.xlsx',X).kind,'mixed');});
test('single alphanumeric employee ID is still a personal report',()=>{const w=wb('personal');w.Sheets.資料.E4.v='558U001';assert.equal(classifyReportWorkbook(w,'report.xls',X).kind,'personal');});
test('store title selects store parser for validation even if data is damaged',()=>{const w={SheetNames:['上線數KPI_店點達成率_明細'],Sheets:{}};assert.equal(classifyReportWorkbook(w,'report.xlsx',X).kind,'store');});
test('unknown input remains unknown rather than being authorized for storage',()=>assert.equal(classifyReportWorkbook({SheetNames:[],Sheets:{}},'data.xlsx',X).kind,'unknown'));
test('personal title selects the existing personal validation workflow',()=>assert.equal(classifyReportWorkbook({SheetNames:['個人達成率'],Sheets:{}},'data.xlsx',X).kind,'personal'));
test('title-only mixed workbook fails closed',()=>assert.equal(classifyReportWorkbook({SheetNames:['店點達成率','個人達成率'],Sheets:{}},'data.xlsx',X).kind,'mixed'));
test('routing does not mutate source workbook or numeric values',()=>{const w=wb();const before=JSON.stringify(w);classifyReportWorkbook(w,'010103.xls',X);assert.equal(JSON.stringify(w),before);});

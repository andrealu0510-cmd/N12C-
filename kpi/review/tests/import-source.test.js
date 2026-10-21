import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {readReportText,readReportFile,decodeReportText,MAX_SOURCE_BYTES} from '../import-source.js';

const context={};
vm.runInNewContext(readFileSync(new URL('../vendor/xlsx.full.min.js',import.meta.url),'utf8'),context);
const XLSX=context.XLSX;

test('Excel clipboard preserves multiline headings, masked names, literal percent and leading-zero IDs',()=>{
 const text='\t'.repeat(1000)+'\n資料日期\t2026/10/20\n員編\t姓名\t"總進度\n達成率"\n0012345\t陳*甲\t72.5%\n558X001\t測*乙\t0.0%';
 const wb=readReportText(text,XLSX),ws=wb.Sheets[wb.SheetNames[0]];
 assert.equal(ws.C3.v,'總進度\n達成率');
 assert.equal(ws.A4.v,'0012345');
 assert.equal(ws.B4.v,'陳*甲');
 assert.equal(ws.C4.v,'72.5%');
 assert.equal(ws.C5.v,'0.0%');
});
test('UTF-16 export decodes Chinese and retains column separators',()=>{
 const buffer=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from('員編\t姓名\r\n0012345\t測*甲','utf16le')]);
 assert.equal(decodeReportText(buffer),'員編\t姓名\r\n0012345\t測*甲');
});
test('TXT uploads share the clipboard parser and do not reinterpret identifiers',async()=>{
 const bytes=new TextEncoder().encode('員編\t姓名\n0012345\t測*甲');
 const wb=await readReportFile({name:'report.txt',size:bytes.length,arrayBuffer:async()=>bytes.buffer},XLSX);
 assert.equal(wb.Sheets[wb.SheetNames[0]].A2.v,'0012345');
});
test('empty, excessive and unsupported input receives an actionable error before parsing',async()=>{
 assert.throws(()=>readReportText(' \n\t',XLSX),/請先貼上/);
 await assert.rejects(readReportFile({name:'report.exe',size:1},XLSX),/請選擇/);
 await assert.rejects(readReportFile({name:'report.xls',size:MAX_SOURCE_BYTES+1},XLSX),/15MB/);
});

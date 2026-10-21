/** Local-only file decoding. Source bytes and pasted content never leave the browser. */
const READ_OPTIONS={cellNF:true,cellText:true,cellDates:true,cellHTML:false,bookVBA:false};
export const MAX_SOURCE_BYTES=15*1024*1024;

function reader(XLSX){
  if(!XLSX?.read)throw new Error('Excel 元件未載入，請重新整理頁面。');
  return XLSX;
}

export function readReportText(value,XLSX){
  reader(XLSX);
  const text=String(value??'').replace(/^\uFEFF/,'');
  if(!text.trim())throw new Error('請先貼上包含表頭與同仁資料的 Excel 內容。');
  if(new TextEncoder().encode(text).length>MAX_SOURCE_BYTES)throw new Error('內容超過 15MB，請選取個人 KPI 工作表後再貼上。');
  // raw keeps employee IDs, percent strings and rounded source values intact.
  // SheetJS handles quoted multiline Excel captions and trailing blank columns.
  const workbook=XLSX.read(text,{...READ_OPTIONS,type:'string',raw:true,...(text.includes('\t')?{FS:'\t'}:{})});
  if(!workbook.SheetNames?.length)throw new Error('沒有讀到表格，請貼上包含表頭與同仁資料的完整範圍。');
  return workbook;
}

export function decodeReportText(buffer){
  const bytes=new Uint8Array(buffer);
  if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes);
  if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{return new TextDecoder('big5').decode(bytes);}
}

export async function readReportFile(file,XLSX){
  reader(XLSX);
  if(!/\.(xlsx|xls|csv|tsv|txt)$/i.test(file?.name||''))throw new Error('請選擇 Excel（.xls／.xlsx）、CSV、TSV 或貼上文字檔（.txt）。');
  if(file.size>MAX_SOURCE_BYTES)throw new Error('檔案超過 15MB，請改用個人 KPI 工作表或較小的檔案。');
  const buffer=await file.arrayBuffer();
  if(/\.(csv|tsv|txt)$/i.test(file.name))return readReportText(decodeReportText(buffer),XLSX);
  return XLSX.read(buffer,{...READ_OPTIONS,type:'array'});
}

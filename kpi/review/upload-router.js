import {readReportFile,readReportText} from './import-source.js';
import {DEFAULT_STORES} from './core.js';

export const UPLOAD_VERSION='20261031.1';
const compact=value=>String(value??'').normalize('NFKC').replace(/\s+/g,'');
const knownStores=new Set(DEFAULT_STORES.map(compact));

/** Routing is not validation: only the existing destination parser may approve a save. */
export function classifyReportWorkbook(workbook,sourceName='',XLSX){
 let storeRows=0,personalRows=0;
 for(const name of workbook?.SheetNames||[]){
  const sheet=workbook.Sheets?.[name];if(!sheet)continue;
  const rows=new Map();
  for(const address of Object.keys(sheet)){
   if(!/^[A-Z]+\d+$/.test(address))continue;
   const cell=XLSX.utils.decode_cell(address),text=compact(sheet[address]?.v);
   if(!text)continue;if(!rows.has(cell.r))rows.set(cell.r,[]);
   rows.get(cell.r).push({c:cell.c,text});
  }
  const heads=[...rows].flatMap(([r,cells])=>cells.filter(x=>x.text==='排名'&&cells.some(y=>y.c===x.c+1&&/總進度/.test(y.text))).map(x=>({r,c:x.c}))).sort((a,b)=>a.r-b.r);
  for(const [r,cells] of rows){
   const head=heads.filter(h=>h.r<r).at(-1);
   const prefix=head?cells.filter(x=>x.c<head.c):cells.filter(x=>x.c<24);
   if(!prefix.some(x=>knownStores.has(x.text)))continue;
   const hasCode=prefix.some(x=>/^DNB\d{5}$/i.test(x.text));
   const hasId=prefix.some(x=>/^55[A-Z0-9]{5}$/i.test(x.text));
   const hasJob=prefix.some(x=>/^(?:代理店長|副店長|店長|業務代表|銷售人員|業代)/.test(x.text));
   if(hasId&&(head||hasJob))personalRows++;
   else if(hasCode&&!hasId&&!hasJob&&head)storeRows++;
  }
 }
 if(storeRows&&personalRows)return{kind:'mixed',storeRows,personalRows};
 if(personalRows)return{kind:'personal',storeRows,personalRows};
 if(storeRows)return{kind:'store',storeRows,personalRows};
 // File/sheet titles only select the parser; they never bypass its validation.
 const hints=compact([sourceName,...(workbook?.SheetNames||[])].join(' '));
 const storeHint=/01[-_]?01[-_]?03|店點達成率/.test(hints);
 const personHint=/01[-_]?01[-_]?05|個人達成率/.test(hints);
 return{kind:storeHint&&personHint?'mixed':storeHint?'store':personHint?'personal':'unknown',storeRows,personalRows};
}

export function installUploadRouter(doc=document,win=window){
 const input=doc.getElementById('fileInput'),pasteButton=doc.getElementById('parsePaste');
 if(!input||input.dataset.reportRouting==='ready')return;
 input.dataset.reportRouting='ready';
 const $=id=>doc.getElementById(id),originalFile=input.onchange,originalPaste=pasteButton?.onclick;
 let busy=false;
 const status=doc.createElement('p');status.id='reportRoutingStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;status.style.cssText='padding:12px 16px;line-height:1.7;border:1px solid #d5dfeb;border-radius:12px;background:#fff;overflow-wrap:anywhere';
 $('uploadStrip').after(status);
 const say=(message,error=false)=>{status.hidden=false;status.textContent=message;status.style.color=error?'#b42332':'';};
 const title=$('uploadStrip').querySelector('strong'),hint=$('uploadStrip').querySelector('p');
 if(title)title.textContent='每日上傳 KPI：店點＋個人';
 if(hint)hint.textContent='01-01-03店點／01-01-05個人自動辨識，分開保存；不需要手動對照欄位。';
 const label=$('uploadLabel');if(label)for(const node of label.childNodes)if(node.nodeType===3&&node.textContent.trim())node.textContent='上傳01-01-05（個人）';
 const storeButton=doc.createElement('button');storeButton.type='button';storeButton.className='button';storeButton.id='storeUploadOpen';storeButton.textContent='上傳01-01-03（店點）';
 const storeInput=doc.createElement('input');storeInput.type='file';storeInput.accept=input.accept;storeInput.id='storeUploadFile';storeInput.hidden=true;
 label.before(storeButton,storeInput);storeButton.onclick=()=>storeInput.click();
 const stableEvent=target=>({target,currentTarget:target,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
 const mixedMessage='這份活頁簿同時含店點與個人報表，為避免存錯資料，本次未送出。請分別上傳01-01-03與01-01-05原始報表。';
 async function routeStore(workbook,name){
  let token='';try{token=win.sessionStorage.getItem('n12c_review_session_v1')||'';}catch{}
  if(!token.startsWith('admin:')||!$('sessionLabel')?.classList.contains('online'))throw new Error('請先以主管帳號登入，再上傳01-01-03店點報表。');
  say('已辨識01-01-03店點報表，正切換至店點雲端存檔流程…');
  if($('importDialog')?.open)$('importDialog').close();
  if($('pasteDialog')?.open)$('pasteDialog').close();
  let sent=false;
  try{
   const {parseStoreWorkbook}=await import('./store-group-core.js?v=20261022-store-parser-2');
   const snapshot=parseStoreWorkbook(workbook,win.XLSX);snapshot.sourceName=String(name||'01-01-03');
   if(!snapshot.rows.length)throw new Error('沒有可儲存的店點資料。');
   sent=true;
   const response=await win.fetch('https://zgpuuliqtrpdjerniyio.supabase.co/functions/v1/n12c-store-summary',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({action:'upload',snapshot}),signal:AbortSignal.timeout(45000)
   });
   const saved=await response.json();
   if(win.sessionStorage.getItem('n12c_review_session_v1')!==token)throw new Error('登入身分已變更，請重新登入並讀回資料確認。');
   if(!response.ok||!saved.ok)throw new Error(saved.error||'伺服器未確認存檔成功。');
   // Refresh through the existing scoped reader, never patch or overwrite personal data.
   await $('ghReload')?.onclick?.();$('ghGroup')?.click();
   const message=(saved.deduplicated?'相同01-01-03店點報表已在雲端，未重複新增。':'01-01-03已存入雲端。')+' 截至 '+snapshot.cutoffDate+'，共 '+snapshot.rows.length+' 店、'+snapshot.metricDefinitions.length+' 項。01-01-05個人資料及回報紀錄未變更。';
   say(message);if($('ghStatus'))$('ghStatus').textContent=message;
   $('storeHierarchy')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){throw new Error((sent?'未確認本次雲端存檔完成：':'判讀未通過，本次未送出或存檔：')+error.message+(sent?' 可按「更新雲端資料」確認；請勿立即重複上傳。':' 原有雲端資料保持不變。'));}
 }
 async function handleFile(event,explicitStore=false){
  event.preventDefault();event.stopImmediatePropagation();
  const target=event.currentTarget||event.target,file=target.files?.[0];if(!file||busy)return;
  busy=true;input.disabled=true;storeInput.disabled=true;storeButton.disabled=true;
  try{
   say('正在辨識報表類型…');
   const workbook=await readReportFile(file,win.XLSX),route=classifyReportWorkbook(workbook,file.name,win.XLSX);
   if(route.kind==='mixed')throw new Error(mixedMessage);
   if(route.kind==='store'||(explicitStore&&route.kind==='unknown'))await routeStore(workbook,file.name);
   else{
    say('已切換至01-01-05個人報表檢核流程；有待確認欄位時不會自動存檔。');
    if(typeof originalFile!=='function')throw new Error('個人報表元件尚未載入，請更新網頁；原有資料未變更。');
    await originalFile.call(input,stableEvent(target));
   }
  }catch(error){say(error.message||'本次未完成上傳，請重試。',true);}
  finally{busy=false;input.disabled=false;storeInput.disabled=false;storeButton.disabled=false;target.value='';}
 }
 input.addEventListener('change',event=>handleFile(event),true);
 storeInput.addEventListener('change',event=>handleFile(event,true),true);
 if(pasteButton)pasteButton.addEventListener('click',async event=>{
  event.preventDefault();event.stopImmediatePropagation();if(busy)return;busy=true;pasteButton.disabled=true;
  try{
   const workbook=readReportText($('pasteInput').value,win.XLSX),route=classifyReportWorkbook(workbook,'Excel貼上內容',win.XLSX);
   if(route.kind==='mixed')throw new Error(mixedMessage);
   if(route.kind==='store'){await routeStore(workbook,'01-01-03｜Excel貼上內容');$('pasteInput').value='';}
   else if(typeof originalPaste==='function')await originalPaste.call(pasteButton,stableEvent(pasteButton));
   else throw new Error('個人報表元件尚未載入，請更新網頁。');
  }catch(error){$('pasteStatus').textContent=error.message;say(error.message,true);}
  finally{busy=false;pasteButton.disabled=false;}
 },true);
 // Keep only the current release label; do not change any account/session behavior.
 for(const badge of doc.querySelectorAll('.footer small'))if(/^版本\s/.test(badge.textContent))badge.remove();
 const badge=doc.createElement('small');badge.id='uploadRoutingVersion';badge.textContent='版本 '+UPLOAD_VERSION+' · 店點／個人上傳自動分流';doc.querySelector('.footer')?.append(badge);
}
if(typeof document!=='undefined')installUploadRouter();

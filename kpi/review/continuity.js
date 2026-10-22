import {createSessionStore,SESSION_KEY} from './session-store.js?v=20261022-persistence-1';
import {retainSubmitTarget} from './login-event.js?v=20261022-persistence-1';

// Load before the legacy app so it can restore a still-valid existing session.
// No password, employee KPI or customer records are persisted on this device.
const sessions=createSessionStore({sessionStorage:()=>window.sessionStorage,localStorage:()=>window.localStorage});
const $=id=>document.getElementById(id);
const activeToken=()=>{try{return sessionStorage.getItem(SESSION_KEY);}catch{return null;}};
sessions.restore();
await import('./app.js?v=20261022-import-threshold-fix');

// Keep the proven parser, validation and server authorization unchanged. This
// small entry module adapts their UI lifecycle; the server still verifies access.
let explicitDemo=false;
const isSignedIn=()=>$('sessionLabel').classList.contains('online');
const privatePanels=[document.querySelector('.metrics-panel'),$('summaryCards'),document.querySelector('.board-panel')].filter(Boolean);
function showLogin(message='請登入主管帳號，系統會讀回已保存的雲端資料，不需重新上傳。'){
 $('loginError').textContent=message;
 $('rememberLogin').checked=sessions.remembered();
 if(!$('loginDialog').open)$('loginDialog').showModal();
}
function refreshStorageUI(){
 const signedIn=isSignedIn();
 for(const panel of privatePanels)panel.hidden=!signedIn&&!explicitDemo;
 $('restoreCloud').hidden=!signedIn;
 $('queueCount').hidden=!signedIn&&!explicitDemo;
 const hasSnapshot=signedIn&&!/示範|尚未發布/.test($('sourceInfo').textContent);
 $('cloudStorageStatus').hidden=!hasSnapshot;
 $('cloudStorageText').textContent=hasSnapshot?'目前顯示已發布的雲端報表。關閉網頁不會刪除資料；重新登入後會自動讀回，也可從「歷史資料」選日期。':'';
 if(!signedIn&&!explicitDemo){
  if($('sessionLabel').textContent!=='尚未登入 · 雲端資料保留')$('sessionLabel').textContent='尚未登入 · 雲端資料保留';
  const notice=$('modeNotice');notice.hidden=false;
 // Use explicit content slots: an unscoped 'div > span' also matches the
 // notice icon because the notice container itself is a div.
 (document.getElementById('modeNoticeIcon')||notice.querySelector(':scope > .notice-icon')).textContent='i';
 (document.getElementById('modeNoticeTitle')||notice.querySelector(':scope > div > strong')).textContent='請登入讀回已保存的雲端資料';
 (document.getElementById('modeNoticeMessage')||notice.querySelector(':scope > div > span')).textContent='已發布的 KPI 報表仍保留，不需要重新上傳。未登入時不顯示正式績效資料。';
  $('demoReset').textContent='查看示範（非正式資料）';
  $('periodMonth').textContent='登入後讀取資料';$('periodDay').textContent='—';$('periodDays').textContent='—';$('periodLabel').textContent='不是空資料，請先登入';
 }
 if(!signedIn&&explicitDemo){
  const notice=$('modeNotice');notice.hidden=false;
  (document.getElementById('modeNoticeIcon')||notice.querySelector(':scope > .notice-icon')).textContent='i';
  (document.getElementById('modeNoticeTitle')||notice.querySelector(':scope > div > strong')).textContent='目前顯示操作示範（非正式資料）';
  (document.getElementById('modeNoticeMessage')||notice.querySelector(':scope > div > span')).textContent='以下為虛構資料，不會覆蓋雲端報表。登入後即可讀回已保存的正式資料。';
  $('demoReset').textContent='重設示範';
 }
 $('publishImport').textContent='儲存至雲端並使用';
}
// Observe only outputs changed by the app, not the panels this module modifies.
const observer=new MutationObserver(refreshStorageUI);
observer.observe($('sessionLabel'),{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
observer.observe($('sourceInfo'),{childList:true,characterData:true,subtree:true});
$('demoReset').addEventListener('click',()=>{explicitDemo=true;refreshStorageUI();});
$('tab-reports').addEventListener('click',event=>{
 if(!isSignedIn()&&!explicitDemo){event.preventDefault();event.stopImmediatePropagation();showLogin();}
},true);
$('historyOpen').addEventListener('click',event=>{
 if(!isSignedIn()){event.preventDefault();event.stopImmediatePropagation();showLogin();}
},true);
$('publishImport').addEventListener('click',event=>{
 if(!isSignedIn()){
  event.preventDefault();event.stopImmediatePropagation();
  $('importStatus').textContent='判讀結果保留在目前頁面。登入後再按「儲存至雲端並使用」，不需重傳。';
  showLogin('請先登入主管，登入後可回到原判讀視窗儲存，不需重新上傳。');
 }
},true);

// The existing handler referenced event.currentTarget after await; retaining
// the target fixes the successful-login-but-no-bootstrap failure.
const loginForm=$('loginForm'), originalSubmit=loginForm.onsubmit;
$('rememberLogin').checked=sessions.remembered();
loginForm.onsubmit=async function(event){
 const stableEvent=retainSubmitTarget(event), remember=$('rememberLogin').checked;
 await originalSubmit.call(this,stableEvent);
 const token=activeToken();
 if(isSignedIn()&&!$('loginDialog').open&&token?.startsWith('admin:')){
  const saved=sessions.save(token,remember);
  $('rememberLogin').checked=remember;
  if(!saved){$('cloudStorageText').textContent+=' 瀏覽器未允許保存登入狀態，重開後請重新登入。';}
 }
 refreshStorageUI();
};
const originalLogout=$('logout').onclick;
$('logout').onclick=function(event){
 // Let the original unsaved-work confirmation finish first. A cancelled logout
// must not clear authentication; successful logout removes remembered tokens.
 originalLogout.call(this,event);
 if(!activeToken())sessions.clear();
};
$('restoreCloud').onclick=()=>location.reload();
window.addEventListener('beforeunload',event=>{
 if($('importDialog').open&&$('importPreview').querySelector('tbody tr')){
  event.preventDefault();event.returnValue='';
 }
});
new MutationObserver(()=>{
 const message=$('toast').textContent;
 if(/主管登入已到期|登入已失效/.test(message)&&!$('loginDialog').open)showLogin('登入驗證已到期，雲端資料仍保留。請重新登入；未送出的回報請登入後再次存檔。');
}).observe($('toast'),{childList:true,characterData:true,subtree:true});
refreshStorageUI();
const footer=document.querySelector('.footer');
if(footer){const badge=document.createElement('small');badge.textContent='版本 20261022.4 · 本店主管績效檢閱';footer.append(badge);}

// Staff use the same authenticated site and existing report save flow.
await import('./staff-entry.js?v=20261022-staff-entry-1');
// Store visibility is verified by a read-only service; individual report permissions are unchanged.
await import('./store-progress.js?v=20261022-store-read-1');
// Separate store report storage; never replaces employee snapshots or reports.
await import('./store-hierarchy.js?v=20261022-store-parser-2');
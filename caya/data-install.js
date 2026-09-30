'use strict';
// No automatic transfer or login interception. Publication is not yet complete.
document.addEventListener('DOMContentLoaded',()=>{
 const error=document.getElementById('loadError');
 const update=document.getElementById('excelOpen');
 const frame=document.getElementById('appFrame');
 const sync=()=>{
  if(!error||!update||!frame)return;
  update.disabled=frame.hidden;
  if(!error.hidden){
   const text=document.getElementById('loadErrorText');
   if(text&&text.textContent.includes('網站正在整理已提供的資料')){
    text.textContent='線上共用資料尚未發布完成，不是缺少你提供的Excel。現在不必重傳資料，也不需要準備HTML。';
   }
  }
 };
 if(error)new MutationObserver(sync).observe(error,{attributes:true,attributeFilter:['hidden']});
 if(frame)new MutationObserver(sync).observe(frame,{attributes:true,attributeFilter:['hidden']});
 sync();
});

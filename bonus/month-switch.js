/* Monthly entry routing only; no report or credentials are changed. */
(()=>{'use strict';
const params=new URLSearchParams(location.search);
const taipeiDate=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
function destination(){return params.get('period')==='2026-11'||(params.get('period')!=='2026-10'&&taipeiDate()>='2026-11-02');}
function check(){if(destination()){const url=new URL('november.html',location.href);url.searchParams.set('period','2026-11');if(params.get('admin')==='1')url.searchParams.set('admin','1');location.replace(url.href);return true;}return false;}
if(check())return;
document.addEventListener('DOMContentLoaded',()=>{const head=document.querySelector('header .top');if(head&&!document.getElementById('novemberEntry')){const a=document.createElement('a');a.id='novemberEntry';a.textContent='11月版｜11/02啟用';a.href='november.html'+(params.get('admin')==='1'?'?admin=1':'');a.style.cssText='font-size:13px;white-space:nowrap;color:#a94712;font-weight:750';head.insertBefore(a,document.getElementById('logout'));}if(params.get('period')==='2026-10'){const link=document.getElementById('modeLink');if(link){const u=new URL(link.href,location.href);u.searchParams.set('period','2026-10');link.href=u.href;}}});
setInterval(()=>{if(!document.hidden)check();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
})();

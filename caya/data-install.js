'use strict';
// The website can finish installing its provided source data after a valid employee login.
// No password, source file, source URL, or administrative credential is present here.
(()=>{
 const base='https://zgpuuliqtrpdjerniyio.supabase.co/functions/v1/';
 const nativeFetch=window.fetch.bind(window),tasks=new Map();
 window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url===base+'caya-price-api/me'){
   const h=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
   const auth=h.get('Authorization');
   if(auth&&/^Bearer [a-f0-9]{64}$/i.test(auth)){
    if(!tasks.has(auth))tasks.set(auth,(async()=>{
     const r=await nativeFetch(base+'caya-data-install',{method:'POST',headers:{Authorization:auth},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(60000)});
     if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'本期資料尚未載入，請稍後重新整理；不用另外準備HTML。');}
    })());
    try{await tasks.get(auth);}catch(e){tasks.delete(auth);throw e;}
   }
  }
  return nativeFetch(input,init);
 };
})();

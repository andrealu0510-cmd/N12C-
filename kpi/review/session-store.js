/** Remember only an existing, time-limited admin session on an opted-in device.
 * No password, KPI data or customer records are stored here. Server bootstrap
 * remains the authority: decoding an expiry never grants access to any data.
 */
export const SESSION_KEY='n12c_review_session_v1';
export const REMEMBER_KEY='n12c_review_remember_v1';
export const REMEMBERED_KEY='n12c_review_remembered_v1';
const LEGACY_KEY='n12c_fixed_token_v1';
export function adminExpiry(token){
 try{
  if(typeof token!=='string'||!token.startsWith('admin:'))return 0;
  const parts=token.slice(6).split('.');if(parts.length!==2||!parts[1])return 0;
  let payload=parts[0].replace(/-/g,'+').replace(/_/g,'/');
  payload=payload.padEnd(Math.ceil(payload.length/4)*4,'=');
  const value=JSON.parse(atob(payload));
  return typeof value.u==='string'&&Number.isSafeInteger(value.exp)?value.exp*1000:0;
 }catch{return 0;}
}
export function createSessionStore({sessionStorage,localStorage,now=Date.now}){
 const get=(source,key)=>{try{return source().getItem(key);}catch{return null;}};
 const put=(source,key,value)=>{try{value===null?source().removeItem(key):source().setItem(key,value);return true;}catch{return false;}};
 const remembered=()=>get(localStorage,REMEMBER_KEY)==='true';
 const validAdmin=token=>adminExpiry(token)>now();
 return {
  remembered,
  save(token,remember=false){
   if(typeof token!=='string'||!token)return false;
   const stored=put(sessionStorage,SESSION_KEY,token);
   const persist=remember===true&&validAdmin(token);
   const preference=put(localStorage,REMEMBER_KEY,persist?'true':'false');
   const persistent=put(localStorage,REMEMBERED_KEY,persist?token:null);
   // Prevent a legacy token from silently signing in after choosing not to remember.
   put(localStorage,LEGACY_KEY,null);
   return stored&&(!persist||(preference&&persistent));
  },
  restore(){
   const active=get(sessionStorage,SESSION_KEY);
   if(active&&(validAdmin(active)||/^staff:[a-f0-9]{64}$/.test(active)))return active;
   if(active)put(sessionStorage,SESSION_KEY,null);
   const saved=get(localStorage,REMEMBERED_KEY);
   if(remembered()&&validAdmin(saved)){put(sessionStorage,SESSION_KEY,saved);return saved;}
   if(saved)put(localStorage,REMEMBERED_KEY,null);
   // Migrate only a currently valid session from the original management entry.
   const legacy=get(localStorage,LEGACY_KEY);
   if(legacy&&validAdmin('admin:'+legacy)){
    const token='admin:'+legacy;put(sessionStorage,SESSION_KEY,token);return token;
   }
   if(legacy)put(localStorage,LEGACY_KEY,null);
   return null;
  },
  clear(){
   const results=[put(sessionStorage,SESSION_KEY,null),put(localStorage,REMEMBERED_KEY,null),put(localStorage,LEGACY_KEY,null),put(localStorage,REMEMBER_KEY,'false')];
   return results.every(Boolean);
  }
 };
}

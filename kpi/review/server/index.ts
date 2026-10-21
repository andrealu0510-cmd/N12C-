import { sanitizeReport } from '../report-sanitize.js';
import { validateReport, findPrivacyIssue } from '../validation.js';
import { validateSnapshot, validDate, taipeiDate } from '../core.js';

const ORIGIN='https://andrealu0510-cmd.github.io';
const ROOT=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN='5512297';
const te=new TextEncoder();
class Failure extends Error { status:number; errors:any; constructor(status:number,message:string,errors:any=null){super(message);this.status=status;this.errors=errors;} }
const enc=(v:any)=>encodeURIComponent(String(v));
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
function out(req:Request,body:any,status=200){const h:any={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type'};if(req.headers.get('origin')===ORIGIN)h['Access-Control-Allow-Origin']=ORIGIN;return new Response(JSON.stringify(body),{status,headers:h});}
async function db(path:string,method='GET',body:any=null,prefer='return=representation'){const r=await fetch(ROOT+'/rest/v1/'+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:prefer},body:body===null?undefined:JSON.stringify(body)});const text=await r.text();if(!r.ok){if(r.status===409)throw new Failure(409,'資料已由其他頁面更新，請重新載入後再儲存。');throw new Failure(500,'資料服務暫時無法完成操作，請稍後重試。');}return text?JSON.parse(text):null;}
async function oldApi(body:any){const r=await fetch(ROOT+'/functions/v1/n12c-kpi-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();return{status:r.status,data};}
async function auth(req:Request){const raw=req.headers.get('authorization')||'';if(!raw.startsWith('Bearer '))throw new Failure(401,'請先登入，或使用主管提供的個人填報連結。');const token=raw.slice(7);if(token.startsWith('admin:')){const r=await oldApi({action:'app',token:token.slice(6)});if(!r.data.ok)throw new Failure(401,'主管登入已到期，請重新登入。');let subject;try{subject=JSON.parse(atob(token.slice(6).split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw new Failure(401,'登入資料無效。');}if(subject.u!==ADMIN||subject.exp<=Math.floor(Date.now()/1000))throw new Failure(403,'此帳號沒有主管權限。');return{role:'admin',employeeId:ADMIN};}if(token.startsWith('staff:')){const t=token.slice(6);if(!/^[a-f0-9]{64}$/.test(t))throw new Failure(401,'個人填報連結無效。');const a=(await db('n12c_review_access?token_hash=eq.'+await hash(t)+'&revoked=eq.false&limit=1'))[0];if(!a||Date.parse(a.expires_at)<=Date.now())throw new Failure(401,'個人填報連結已到期或撤銷，請向主管取得新連結。');return{role:'staff',employeeId:a.employee_id,expiresAt:a.expires_at};}throw new Failure(401,'登入資料無效。');}
function admin(user:any){if(user.role!=='admin')throw new Failure(403,'此操作限主管使用。');}
function own(user:any,id:string){if(user.role!=='admin'&&user.employeeId!==id)throw new Failure(403,'只能存取本人的回報。');}
function snapshot(row:any,user:any){if(!row)return null;const p={...row.payload,id:row.id,createdAt:row.created_at};if(user.role!=='admin')p.rows=p.rows.filter((e:any)=>e.employeeId===user.employeeId);return p;}
async function getSnapshot(id:string){if(!/^[a-f0-9-]{36}$/.test(id||''))throw new Failure(400,'請先選擇已發布的資料。');const s=(await db('n12c_review_snapshots?id=eq.'+enc(id)+'&limit=1'))[0];if(!s)throw new Failure(404,'找不到這份 KPI 資料。');return s;}
const record=(r:any)=>r?{id:r.id,snapshotId:r.snapshot_id,employeeId:r.employee_id,reportDate:r.report_date,report:r.payload,status:r.status,review:r.manager_review,revision:r.revision,submittedAt:r.submitted_at,updatedAt:r.updated_at}:null;
function checkSettings(b:any){if(!Array.isArray(b.selectedMetricKeys)||!b.selectedMetricKeys.length||b.selectedMetricKeys.length>100||b.selectedMetricKeys.some((k:any)=>typeof k!=='string'||k.length>120))throw new Failure(400,'請至少選擇一個提醒項目。');if(!['overall_and_metric','metric_and_achievement'].includes(b.rule))throw new Failure(400,'請選擇有效的回報規則。');return{selectedMetricKeys:b.selectedMetricKeys,rule:b.rule};}
Deno.serve(async(req:Request)=>{try{
 const origin=req.headers.get('origin');if(origin&&origin!==ORIGIN)throw new Failure(403,'此來源不允許存取。');
 if(req.method==='OPTIONS')return out(req,{ok:true});
 if(req.method==='GET'&&new URL(req.url).searchParams.get('health')==='1')return out(req,{ok:true,service:'n12c-review-api',version:'2026.10.21.2-masked-contacts'});
 if(req.method!=='POST')throw new Failure(405,'只接受 POST。');
 if(Number(req.headers.get('content-length')||0)>4000000)throw new Failure(413,'資料過大，請先縮小店點範圍。');
 const text=await req.text();if(text.length>4000000)throw new Failure(413,'資料過大。');let b:any;try{b=JSON.parse(text);}catch{throw new Failure(400,'資料格式不正確。');}
 if(b.action==='login'){
  const identity=await hash(req.headers.get('x-forwarded-for')?.split(',')[0]||req.headers.get('cf-connecting-ip')||'unknown');
  const n=await db('rpc/n12c_review_count_login','POST',{p_key:identity,p_window:Math.floor(Date.now()/600000)});
  if(n>12)throw new Failure(429,'嘗試登入次數過多，請 10 分鐘後再試。');
  if(typeof b.password!=='string'||b.password.length>128||String(b.username||'').trim()!==ADMIN)throw new Failure(401,'帳號或密碼不正確。');
  const r=await oldApi({action:'login',username:String(b.username).trim(),password:b.password});
  if(!r.data.ok)throw new Failure(401,'帳號或密碼不正確。');
  return out(req,{ok:true,token:'admin:'+r.data.token,user:{role:'admin',employeeId:ADMIN},expiresIn:r.data.expires_in});
 }
 const user=await auth(req);
 if(b.action==='bootstrap'){
  const [raw,settings,history]=await Promise.all([db('n12c_review_snapshots?order=cutoff_date.desc,created_at.desc&limit=1'),db('n12c_review_settings?id=eq.current&limit=1'),db('n12c_review_snapshots?select=id,cutoff_date,source_name,created_at&order=cutoff_date.desc,created_at.desc&limit=60')]);
  return out(req,{ok:true,user,snapshot:snapshot(raw[0],user),settings:settings[0]?.payload||null,history:history.map((h:any)=>({id:h.id,cutoffDate:h.cutoff_date,sourceName:user.role==='admin'?h.source_name:'個人 KPI 快照',createdAt:h.created_at}))});
 }
 if(b.action==='snapshot'){return out(req,{ok:true,snapshot:snapshot(await getSnapshot(b.id),user)});}
 if(b.action==='upload'){
  admin(user);const errors=validateSnapshot(b.snapshot);if(errors.length)throw new Failure(422,'資料檢核未通過，未發布。',errors.map((message:string)=>({path:'upload',label:'Excel資料',message})));
  const p=b.snapshot;const clean={cutoffDate:p.cutoffDate,sourceName:String(p.sourceName||'01-01-05').slice(0,240),sheetName:String(p.sheetName||'').slice(0,240),metricDefinitions:p.metricDefinitions,rows:p.rows,selectedMetricKeys:p.selectedMetricKeys||[],rule:p.rule||'overall_and_metric',importNotes:p.importNotes||[]};
  const r=await db('n12c_review_snapshots','POST',{cutoff_date:p.cutoffDate,source_name:clean.sourceName,payload:clean,created_by:user.employeeId});
  return out(req,{ok:true,snapshot:snapshot(r[0],user)},201);
 }
 if(b.action==='settings'){admin(user);const settings=checkSettings(b);await db('n12c_review_settings?on_conflict=id','POST',{id:'current',payload:settings,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=minimal');return out(req,{ok:true,settings});}
 if(b.action==='create_access'){
  admin(user);const s=await getSnapshot(b.snapshotId);const employee=s.payload.rows.find((e:any)=>e.employeeId===b.employeeId);if(!employee)throw new Failure(404,'此員編不在所選資料中。');
  const token=random(),expiresAt=new Date(Date.now()+7*86400000).toISOString();await db('n12c_review_access','POST',{token_hash:await hash(token),employee_id:employee.employeeId,expires_at:expiresAt,created_by:user.employeeId});
  return out(req,{ok:true,token,employeeId:employee.employeeId,expiresAt});
 }
 if(b.action==='revoke_access'){admin(user);if(!/^[A-Za-z0-9-]{3,20}$/.test(b.employeeId||''))throw new Failure(400,'員編無效。');await db('n12c_review_access?employee_id=eq.'+enc(b.employeeId),'PATCH',{revoked:true});return out(req,{ok:true});}
 if(b.action==='list_reports'){
  let path='n12c_review_reports?order=report_date.desc,updated_at.desc&limit=300';if(user.role!=='admin')path+='&employee_id=eq.'+enc(user.employeeId);else if(b.employeeId)path+='&employee_id=eq.'+enc(b.employeeId);if(b.reportDate){if(!validDate(b.reportDate))throw new Failure(400,'回報日期不正確。');path+='&report_date=eq.'+enc(b.reportDate);}return out(req,{ok:true,records:(await db(path)).map(record)});
 }
 if(b.action==='get_report'){own(user,b.employeeId);if(!validDate(b.reportDate))throw new Failure(400,'回報日期不正確。');const r=(await db('n12c_review_reports?employee_id=eq.'+enc(b.employeeId)+'&report_date=eq.'+enc(b.reportDate)+'&limit=1'))[0];return out(req,{ok:true,record:record(r)});}
 if(b.action==='save_report'){
  const p=b.report;own(user,p?.employeeId);const s=await getSnapshot(p?.snapshotId);const employee=s.payload.rows.find((e:any)=>e.employeeId===p.employeeId);if(!employee)throw new Failure(422,'員編不在 KPI 資料內，未儲存。');
  const result=validateReport(p,{employee,snapshot:{...s.payload,id:s.id},role:user.role,nowDate:taipeiDate()});if(!result.ok)throw new Failure(422,'不予存檔：請修正以下內容。',result.errors);
  const prior=(await db('n12c_review_reports?employee_id=eq.'+enc(p.employeeId)+'&report_date=eq.'+enc(p.reportDate)+'&limit=1'))[0];
  if(prior&&prior.snapshot_id!==s.id)throw new Failure(409,'既有回報的KPI資料版本不可更換，請開啟原回報修改。');
  if(prior?.status==='approved')throw new Failure(409,'這份回報已完成主管核實，請先由主管退回後再修改。');
  if(prior&&Number(b.revision)!==prior.revision)throw new Failure(409,'已有更新版本，請重新載入後再修改。');
  const values={snapshot_id:s.id,employee_id:p.employeeId,report_date:p.reportDate,payload:sanitizeReport(p),status:'pending',manager_review:prior?.manager_review||null,revision:(prior?.revision||0)+1,updated_at:new Date().toISOString()};
  let saved;if(prior)saved=await db('n12c_review_reports?id=eq.'+enc(prior.id)+'&revision=eq.'+prior.revision,'PATCH',values);else saved=await db('n12c_review_reports','POST',values);if(!saved.length)throw new Failure(409,'版本已更新，請重新載入。');
  return out(req,{ok:true,record:record(saved[0]),warnings:result.warnings});
 }
 if(b.action==='review'){
  admin(user);if(!/^[a-f0-9-]{36}$/.test(b.id||''))throw new Failure(400,'回報編號不正確。');const r=(await db('n12c_review_reports?id=eq.'+enc(b.id)+'&limit=1'))[0];if(!r)throw new Failure(404,'找不到回報。');
  if(!['returned','approved'].includes(b.status))throw new Failure(400,'請選擇核實或退回。');
  const inputReview=b.review||{};const review:any={};for(const k of ['manager','evidence','coaching','nextCheck']){if(typeof inputReview[k]!=='string')throw new Failure(422,'不予存檔：主管核實欄位須為文字。');review[k]=inputReview[k].trim();}for(const [key,label] of [['manager','核實主管'],['evidence','核對依據'],['coaching','具體輔導內容'],['nextCheck','下次檢核日期']] as const){const v=String(review[key]||'').trim();if(v.length<(key==='manager'?2:key==='nextCheck'?10:8)||v.length>300||/^(已提醒|已宣導|請加油|無|同上|不適用)[。.!！]*$/.test(v))throw new Failure(422,'不予存檔：請填寫'+label+'。');}
  if(!validDate(review.nextCheck)||review.nextCheck<r.report_date)throw new Failure(422,'不予存檔：下次檢核日期不正確。');
  for(const key of ['manager','evidence','coaching']){const issue=findPrivacyIssue(review[key]);if(issue)throw new Failure(422,'不予存檔：主管核實內容'+issue);}
  const revision=Number(b.revision);const saved=await db('n12c_review_reports?id=eq.'+enc(b.id)+'&revision=eq.'+revision,'PATCH',{status:b.status,manager_review:{...review,reviewedBy:user.employeeId,reviewedAt:new Date().toISOString()},revision:revision+1,updated_at:new Date().toISOString()});if(!saved.length)throw new Failure(409,'回報已更新，請重新載入後核實。');return out(req,{ok:true,record:record(saved[0])});
 }
 throw new Failure(400,'不支援此操作。');
 }catch(e){const error=e instanceof Failure?e:new Failure(500,'服務暫時無法完成操作，請稍後再試。');return out(req,{ok:false,error:error.message,errors:error.errors},error.status);}
});

'use strict';
/* CAYA 6.6: alphanumeric employee IDs and private roster account management.
   No employee roster or password is stored in this public script. */
(() => {
 const fieldIds=['employee','accountId'];
 const canonical=value=>String(value??'').trim().toUpperCase();
 for(const id of fieldIds){
  const field=document.getElementById(id);if(!field)continue;
  field.inputMode='text';field.pattern='[A-Za-z0-9]{7}';field.maxLength=7;
  field.autocapitalize='characters';field.setAttribute('autocorrect','off');field.spellcheck=false;
  field.placeholder='7碼員編，可含英文字母';
  field.addEventListener('change',()=>{field.value=canonical(field.value);});
 }
 try{const saved=canonical(localStorage.getItem('caya_price_remember_id'));if(/^[A-Z0-9]{7}$/.test(saved)&&!document.getElementById('employee').value){document.getElementById('employee').value=saved;document.getElementById('remember').checked=true;}}catch{}
 const name=document.getElementById('accountName');if(name){name.readOnly=true;name.placeholder='選取名單後自動帶入';}
 const nameLabel=document.querySelector('label[for="accountName"]');if(nameLabel)nameLabel.textContent='姓名（依核准名單）';
 const create=document.getElementById('createAccount');if(create)create.textContent='開通同仁';
 const headings=document.querySelectorAll('#accountsDialog .two h3');if(headings[0])headings[0].textContent='限定登入名單';if(headings[1])headings[1].textContent='開通／重設同仁密碼';
 const loginNote=document.querySelector('#loginView .note');if(loginNote)loginNote.textContent='僅限核准名單登入。列入名單後，仍須先設定密碼；英文字母可直接輸入。';
 const version=document.querySelector('#loginView .login-card>small');if(version)version.textContent='v6.6 · 限定名單登入／英數員編／各版本分欄查價';
 const warning=document.querySelector('#accountForm p.muted');if(warning)warning.textContent='僅能開通名單內的員編。待開通者須先設定密碼；同仁密碼須與管理員不同。';
 let members=new Map();
 const accountId=document.getElementById('accountId');
 if(accountId)accountId.addEventListener('input',()=>{const m=members.get(canonical(accountId.value));if(name)name.value=m?.display_name||'';});
 function setIdentity(){
  const badge=document.getElementById('userBadge');
  if(!badge||typeof user==='undefined'||!user)return;
  const expected=user.employee_id+' · '+(user.display_name?user.display_name+' · ':'')+(user.role==='admin'?'管理員':'同仁');
  if(badge.textContent!==expected)badge.textContent=expected;
 }
 const badge=document.getElementById('userBadge');if(badge)new MutationObserver(setIdentity).observe(badge,{childList:true,characterData:true,subtree:true});setIdentity();
 window.listAccounts=async function(){
  const result=await request('accounts');
  if(!Array.isArray(result.accounts)||result.roster_only!==true)throw Error('限定登入名單服務尚未更新，請稍後重新開啟。');
  members=new Map(result.accounts.map(a=>[a.employee_id,a]));
  const box=document.getElementById('accountList');box.replaceChildren();
  const summary=document.createElement('p');summary.className='muted';summary.textContent='名單 '+result.accounts.length+' 人｜待開通 '+result.accounts.filter(a=>a.configured===false).length+' 人';box.append(summary);
  for(const a of result.accounts){
   const row=document.createElement('div');row.className='account';row.dataset.employeeId=a.employee_id;
   const title=document.createElement('b');title.textContent=a.employee_id+(a.display_name?' · '+a.display_name:'');
   const detail=document.createElement('small');detail.textContent=(a.role==='admin'?'督導管理員':'同仁')+' · '+(a.configured===false?'待開通：尚未設定密碼':a.active?'已啟用':'已停用');row.append(title,detail);
   if(a.role!=='admin'){
    const buttons=document.createElement('div');buttons.className='buttons';
    const fill=document.createElement('button');fill.type='button';fill.textContent=a.configured===false?'設定初始密碼':'填入重設表單';
    fill.onclick=()=>{document.getElementById('accountId').value=a.employee_id;document.getElementById('accountName').value=a.display_name||'';document.getElementById('accountPw').value='';document.getElementById('accountPw').focus();message('accountsStatus',a.configured===false?'輸入此同仁的初始密碼，再按「開通同仁」。':'輸入新密碼，再按「重設該員編密碼」；已停用者須另外啟用。');};buttons.append(fill);
    if(a.configured!==false){
     const toggle=document.createElement('button');toggle.type='button';toggle.textContent=a.active?'停用':'啟用';
     toggle.onclick=async()=>{if(!confirm('確定'+(a.active?'停用':'啟用')+' '+a.employee_id+'？'))return;toggle.disabled=true;try{await request('account-status',{method:'POST',body:{employee_id:a.employee_id,active:!a.active}});await window.listAccounts();message('accountsStatus','帳號狀態已更新。');}catch(e){message('accountsStatus',e.message,true);toggle.disabled=false;}};buttons.append(toggle);
    }
    row.append(buttons);
   }
   box.append(row);
  }
 };
 window.cayaRosterUIVersion='6.6';
})();

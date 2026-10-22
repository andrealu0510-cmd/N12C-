import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionStore,adminExpiry,SESSION_KEY,REMEMBER_KEY,REMEMBERED_KEY} from '../session-store.js';
const epoch=Date.UTC(2026,9,22,2);
const token=(expiry=epoch+8*3600000)=>'admin:'+btoa(JSON.stringify({u:'TEST-ADMIN',exp:expiry/1000}))+'.signature';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
function setup(){let current=epoch;const local=memory();let session=memory();const store=()=>createSessionStore({localStorage:()=>local,sessionStorage:()=>session,now:()=>current});return{local,get session(){return session},store,reopen(){session=memory();return store()},expire(){current+=9*3600000}};}
test('remembered valid supervisor session survives closing the entire tab',()=>{const x=setup();assert.equal(x.store().save(token(),true),true);assert.equal(x.reopen().restore(),token());});
test('unchecked remember does not persist admin session',()=>{const x=setup();x.store().save(token(),false);assert.equal(x.reopen().restore(),null);});
test('original expiry is not extended on reopening',()=>{const x=setup();x.store().save(token(),true);x.expire();assert.equal(x.reopen().restore(),null);assert.equal(x.local.getItem(REMEMBERED_KEY),null);});
test('logout removes session, remembered session and original entry token',()=>{const x=setup();x.store().save(token(),true);x.local.setItem('n12c_fixed_token_v1',token().slice(6));x.store().clear();assert.equal(x.store().restore(),null);assert.equal(x.reopen().restore(),null);});
test('staff links never persist across closed tabs',()=>{const x=setup();const t='staff:'+'a'.repeat(64);x.store().save(t,true);assert.equal(x.store().restore(),t);assert.equal(x.reopen().restore(),null);});
test('migrates only valid original KPI token',()=>{const x=setup();x.local.setItem('n12c_fixed_token_v1',token().slice(6));assert.equal(x.store().restore(),token());x.expire();assert.equal(x.reopen().restore(),null);});
test('opting out removes legacy persistence instead of silently restoring it',()=>{const x=setup();x.local.setItem('n12c_fixed_token_v1',token().slice(6));x.store().save(token(),false);assert.equal(x.reopen().restore(),null);});
test('damaged or expired data cannot restore',()=>{const x=setup();x.local.setItem(REMEMBER_KEY,'true');x.local.setItem(REMEMBERED_KEY,'admin:broken.signature');assert.equal(x.store().restore(),null);assert.equal(adminExpiry('broken'),0);});
test('privacy mode storage failures are handled without throwing',()=>{const fail=()=>{throw new Error('storage disabled')};const x=createSessionStore({localStorage:fail,sessionStorage:fail});assert.equal(x.restore(),null);assert.equal(x.save(token(),true),false);assert.doesNotThrow(()=>x.clear());});
test('anonymous marker alone never authenticates',()=>{const x=setup();x.local.setItem(REMEMBER_KEY,'true');assert.equal(x.reopen().restore(),null);});

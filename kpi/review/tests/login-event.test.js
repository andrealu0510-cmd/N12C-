import test from 'node:test';
import assert from 'node:assert/strict';
import {retainSubmitTarget} from '../login-event.js';
test('retains form currentTarget after asynchronous dispatch has ended',async()=>{
 const form=new EventTarget();let done;
 const completed=new Promise(resolve=>done=resolve);
 form.addEventListener('submit',async event=>{
  const stable=retainSubmitTarget(event);stable.preventDefault();
  await Promise.resolve();
  assert.equal(event.currentTarget,null);
  assert.equal(stable.currentTarget,form);
  assert.equal(stable.defaultPrevented,true);
  done();
 });
 const event=new Event('submit',{cancelable:true});form.dispatchEvent(event);await completed;
});

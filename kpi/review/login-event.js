/** DOM Event.currentTarget becomes null after dispatch. Retain only its form
 * reference for the existing async handler; all other operations use the real event.
 */
export function retainSubmitTarget(event){
 const form=event.currentTarget;
 return new Proxy(event,{get(target,key){
  if(key==='currentTarget')return form;
  const value=Reflect.get(target,key,target);
  return typeof value==='function'?value.bind(target):value;
 }});
}

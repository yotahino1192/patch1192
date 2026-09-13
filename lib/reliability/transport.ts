import { asFailure, classifyStatus, retryAfter, ReliabilityError } from './errors.ts';
import { reportDiagnostic } from './observability.ts';
export async function withDeadline<T>(action:()=>Promise<T>,ms:number,signal?:AbortSignal,onTimeout?:()=>void):Promise<T> {
 if(signal?.aborted)throw new ReliabilityError('cancelled');
 let timer:ReturnType<typeof setTimeout>|undefined;
 let abort:()=>void=()=>{};
 const deadline=new Promise<never>((_,reject)=>{
  abort=()=>reject(new ReliabilityError('cancelled'));
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{reject(new ReliabilityError('timeout'));onTimeout?.();},ms);
 });
 try{if(signal?.aborted)throw new ReliabilityError('cancelled');return await Promise.race([Promise.resolve().then(action),deadline]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
/** One dispatch only. A timed-out native request may still finish remotely; never replay it here. */
const cooldowns=new Map<string,number>();
export async function reliableRequest(transport:(url:string,options?:RequestInit)=>Promise<Response>,url:string,options:RequestInit={},timeoutMs=30000):Promise<Response> {
 const id=crypto.randomUUID(),started=Date.now(),controller=new AbortController();
 const headers=new Headers(options.headers);headers.set('X-Request-ID',id);
 const lane=JSON.stringify([headers.get('x-patch-account'),headers.get('x-patch-session'),options.method||'GET',url]);
 const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
 try{
  if(typeof navigator!=='undefined' && navigator.onLine===false)throw new ReliabilityError('offline');
  const remaining=(cooldowns.get(lane)||0)-Date.now();
  if(remaining>0)throw new ReliabilityError('rate_limit',429,undefined,id,remaining);
  cooldowns.delete(lane);
  const response=await withDeadline(async()=>{
   const res=await transport(url,{...options,headers,signal:controller.signal});
   // Bound the body read too: fetch headers alone are not a completed JSON API response.
   const bytes=await res.arrayBuffer();
   return new Response([204,205,304].includes(res.status)?null:bytes,{status:res.status,statusText:res.statusText,headers:res.headers});
  },timeoutMs,options.signal||undefined,abort);
  response.headers.set('X-Request-ID',id);
  const cooldown=response.status===429?retryAfter(response.headers.get('retry-after')):0;
  if(cooldown){if(cooldowns.size>=256)cooldowns.delete(cooldowns.keys().next().value!);cooldowns.set(lane,Date.now()+cooldown);}

  if(!response.ok)reportDiagnostic({event:'request_failed',kind:classifyStatus(response.status),status:response.status,requestId:id,durationMs:Date.now()-started});
  return response;
 }catch(error){const failure=asFailure(error);failure.requestId=id;reportDiagnostic({event:'request_failed',kind:failure.kind,requestId:id,durationMs:Date.now()-started});throw failure;}
 finally{options.signal?.removeEventListener('abort',abort);}
}

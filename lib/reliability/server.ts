import {reportDiagnostic,safeId} from './observability.ts';
import {readinessDiagnostic, type ReadinessReporter} from './readiness-diagnostics.ts';
export function observeRoute(handler:(request:Request)=>Promise<Response>) {
 return async(request:Request)=>{
  const id=safeId(request.headers.get('x-request-id'))||crypto.randomUUID();const start=Date.now();
  let response:Response;
  try{response=await handler(request);}catch{response=Response.json({code:'SERVICE_UNAVAILABLE',error:'サービスに接続できません。'},{status:503});}
  const headers=new Headers(response.headers);headers.set('X-Request-ID',id);headers.set('Cache-Control','no-store');
  if(response.status>=500 || response.status===401 || response.status===403){
   const record=reportDiagnostic({event:'request_failed',status:response.status,requestId:id,durationMs:Date.now()-start});
   // Only the allowlisted record is written; no URL, error, request or response content.
   try{console.info(JSON.stringify(record));}catch{/* logging cannot change response */}
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 };
}
/** Single flight per process. Only completed checks populate the short cache. */
export function readinessProbe(check:()=>Promise<void>,timeoutMs=2000,ttlMs=5000,report:ReadinessReporter=readinessDiagnostic){
 let pending:Promise<boolean>|undefined,cached=false,expires=0;
 const record=(outcome:'ok'|'failed'|'timeout',start:number)=>{try{report('total',outcome,performance.now()-start);}catch{/* Logging cannot change the result. */}};
 return async(keepAlive?:(work:Promise<boolean>)=>void)=>{
  if(Date.now()<expires)return cached;
  if(!pending){
   const start=performance.now();
   pending=Promise.resolve().then(check).then(()=>true,()=>false).then(ok=>{
    cached=ok;expires=Date.now()+ttlMs;record(ok?'ok':'failed',start);return ok;
   }).finally(()=>{pending=undefined;});
  }
  // Register the existing work with the hosting lifecycle before returning.
  // No second check is started by after()/waitUntil or by concurrent callers.
  const work=pending;
  keepAlive?.(work);
  const start=performance.now();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work,new Promise<boolean>(resolve=>{timer=setTimeout(()=>{record('timeout',start);resolve(false);},timeoutMs);})]);}
  finally{clearTimeout(timer);}
 };
}

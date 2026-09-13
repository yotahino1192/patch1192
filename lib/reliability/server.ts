import {reportDiagnostic,safeId} from './observability.ts';
export function observeRoute(handler:(request:Request)=>Promise<Response>) {
 return async(request:Request)=>{
  const id=safeId(request.headers.get('x-request-id'))||crypto.randomUUID();const start=Date.now();
  let response:Response;
  try{response=await handler(request);}catch{response=Response.json({code:'SERVICE_UNAVAILABLE',error:'サービスに接続できません。'},{status:503});}
  const headers=new Headers(response.headers);headers.set('X-Request-ID',id);headers.set('Cache-Control','no-store');
  if(response.status>=500){
   const record=reportDiagnostic({event:'request_failed',status:response.status,requestId:id,durationMs:Date.now()-start});
   // Only the allowlisted record is written; no URL, error, request or response content.
   try{console.info(JSON.stringify(record));}catch{/* logging cannot change response */}
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 };
}
/** Bounded public probe: at most one DB validation in flight per process; never dispatch AI/Clerk. */
export function readinessProbe(check:()=>Promise<void>,timeoutMs=2000,ttlMs=5000){
 let pending:Promise<boolean>|undefined,cached=false,expires=0;
 return async()=>{
  if(Date.now()<expires)return cached;
  if(!pending)pending=Promise.resolve().then(check).then(()=>true,()=>false).finally(()=>{pending=undefined;});
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{cached=await Promise.race([pending,new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),timeoutMs);})]);expires=Date.now()+ttlMs;return cached;}
  finally{clearTimeout(timer);}
 };
}

// Provider-neutral, closed vocabulary. Never accepts messages, URL/query, bodies, users or Error objects.
import type { FailureKind } from './errors.ts';
const kinds = new Set(['offline','timeout','unauthorized','forbidden','not_found','conflict','rate_limit','server','schema_not_ready','ai_unavailable','unknown','cancelled','invalid_response']);
export type Diagnostic = {event:'request_failed'|'fatal'|'unhandled'|'readiness'; kind?:FailureKind; status?:number; durationMs?:number; requestId?:string};
let provider:(record:Readonly<Diagnostic>)=>void=()=>{};
export function configureDiagnostics(next:typeof provider){provider=next;return()=>{provider=()=>{};};}
export function safeId(value:unknown):string|undefined {return typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:undefined;}
export function reportDiagnostic(input:Diagnostic) {
 const event=['request_failed','fatal','unhandled','readiness'].includes(input.event)?input.event:'unhandled';
 const out:Diagnostic={event};
 if(input.kind&&kinds.has(input.kind))out.kind=input.kind;
 if(Number.isInteger(input.status)&&input.status!>=100&&input.status!<=599)out.status=input.status;
 if(Number.isFinite(input.durationMs)&&input.durationMs!>=0)out.durationMs=Math.round(input.durationMs!);
 const id=safeId(input.requestId);if(id)out.requestId=id;
 try{provider(Object.freeze(out));}catch{/* Reporting cannot break recovery. */}
 return out;
}

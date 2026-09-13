export type FailureKind = 'offline' | 'timeout' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limit' | 'server' | 'schema_not_ready' | 'ai_unavailable' | 'unknown' | 'cancelled' | 'invalid_response';
const messages: Record<FailureKind,string> = {
 offline:'オフラインです。表示済みの教材は確認できます。保存やAI操作は接続後に確認してください。',
 timeout:'応答を確認できませんでした。操作が完了している場合があります。再読み込みで状態を確認してください。',
 unauthorized:'ログインを再確認してください。', forbidden:'この操作は許可されていません。アカウントと同意設定を確認してください。',
 not_found:'対象が見つかりません。ホームで最新の状態を確認してください。', conflict:'状態が変更されたか、処理中です。最新の状態を確認してください。',
 rate_limit:'利用制限に達しました。時間を置いてから再試行してください。', server:'サーバーに接続できません。表示中の内容を残して、時間を置いて再試行してください。',
 schema_not_ready:'サービスの準備中です。時間を置いてから再試行してください。',
 ai_unavailable:'AIの応答を確認できません。自動再送は行いません。保存済み教材の学習は続けられます。',
 unknown:'処理結果を確認できません。再送せず、最新の状態を確認してください。', cancelled:'操作が中断されました。現在のアカウントで状態を確認してください。',
 invalid_response:'応答を読み取れませんでした。保存内容を確認するため、時間を置いて再読み込みしてください。',
};
export class ReliabilityError extends Error {
 kind:FailureKind; status?:number; code?:string; requestId?:string; retryAfterMs:number;
 constructor(kind:FailureKind,status?:number,code?:string,requestId?:string,retryAfterMs=0) { super(messages[kind]); this.name='ReliabilityError';this.kind=kind;this.status=status;this.code=code;this.requestId=requestId;this.retryAfterMs=retryAfterMs; }
}
export function classifyStatus(status:number,code?:string):FailureKind {
 if(status===401)return 'unauthorized';
 if(code==='SCHEMA_NOT_READY')return 'schema_not_ready';
 if(code==='AI_REQUEST_UNKNOWN'||code==='AI_UNKNOWN')return 'unknown';
 if(status===429)return 'rate_limit';
 if(code?.startsWith('AI_') && status>=500)return 'ai_unavailable';
 if(status===403)return 'forbidden'; if(status===404)return 'not_found'; if(status===409)return 'conflict';
 return status>=500?'server':'unknown';
}
export function retryAfter(value:string|null,now=Date.now()):number {
 if(!value)return 0; const seconds=Number(value); const ms=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
 return Number.isFinite(ms)?Math.max(0,Math.min(ms,86400000)):0;
}
export function retryPolicy(error:ReliabilityError,method='GET',hasStableOperationId=false) {
 const read=['GET','HEAD'].includes(method.toUpperCase());
 const transient=['offline','timeout','server','schema_not_ready','rate_limit','invalid_response'].includes(error.kind);
 return {automatic:false as const, manual:read&&transient, reconcileFirst:!read, preserveOperationId:!read&&hasStableOperationId, delayMs:error.retryAfterMs};
}
export function asFailure(error:unknown):ReliabilityError {
 if(error instanceof ReliabilityError)return error;
 if(error instanceof Error && error.name==='AbortError')return new ReliabilityError('cancelled');
 return new ReliabilityError(typeof navigator!=='undefined' && navigator.onLine===false?'offline':'server');
}
export async function readApiResponse<T>(response:Response):Promise<T> {
 let body:unknown;
 try {body=await response.json();} catch(error) {if(error instanceof Error && error.name==='StaleAccountError')throw error; throw new ReliabilityError('invalid_response',response.status);}
 if(!response.ok){
  const raw=body && typeof body==='object' && 'code' in body?body.code:undefined;
  const code=typeof raw==='string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(raw)?raw:undefined;
  throw new ReliabilityError(classifyStatus(response.status,code),response.status,code,response.headers.get('x-request-id')||undefined,retryAfter(response.headers.get('retry-after')));
 }
 return body as T;
}

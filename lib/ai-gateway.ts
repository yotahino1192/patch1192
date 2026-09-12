import { startAi, finishAi, type AiPermit } from "../db/privacy-store";
import type { Transaction } from "@libsql/client";
// All three entry points share this admission boundary. A started request is never automatically replayed.
export async function runAi<T>(userId:string,operationId:string,kind:string,payload:unknown,send:()=>Promise<T>,save?:(tx:Transaction,result:T,permit:AiPermit)=>Promise<void>):Promise<T> {
  const permit=await startAi(userId,operationId,kind,payload);
  const result=await send();
  return finishAi(permit,result,save ? tx=>save(tx,result,permit) : undefined);
}

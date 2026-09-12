import { requireAuth, authErrorResponse } from "../../../lib/auth-server";
import { InputError, readJsonObject, validId } from "../../../lib/api-input";
import { retentionSnapshot, saveRetentionPreferences, startStudySession } from "../../../db/retention";
import { validTimezone } from "../../../lib/retention";
export const runtime="nodejs";export const dynamic="force-dynamic";
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store"}});
async function handle(request:Request){try{
 const {userId}=await requireAuth(request);const timezone=request.headers.get("x-patch-timezone")||undefined;
 if(timezone&&!validTimezone(timezone))throw new InputError("タイムゾーンを確認してください。");
 if(request.method==="POST"){const body=await readJsonObject(request);
  if(body.action==="start"){
   if(!validId(body.id)||!Array.isArray(body.cardIds)||!body.cardIds.length||body.cardIds.length>1000||!body.cardIds.every(validId)||new Set(body.cardIds).size!==body.cardIds.length)throw new InputError("学習対象を確認してください。");
   return json(await startStudySession(userId,body.id,body.cardIds,timezone));
  }
  if(body.action!=="preferences"||typeof body.reminderTime!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.reminderTime)||typeof body.reviewReminder!=="boolean"||typeof body.streakWarning!=="boolean")throw new InputError("通知設定を確認してください。");
  await saveRetentionPreferences(userId,{reminderTime:body.reminderTime,reviewReminder:body.reviewReminder,streakWarning:body.streakWarning},timezone);
 }
 return json(await retentionSnapshot(userId,timezone));
 }catch(error){return authErrorResponse(error)||json({error:error instanceof InputError?error.message:"Retentionを同期できませんでした。"},error instanceof InputError?error.status:500);}}
export const GET=handle;export const POST=handle;

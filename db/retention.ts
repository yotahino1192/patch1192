import type { Transaction } from "@libsql/client";
import { database, initializeDatabase } from "./client";
import { advanceClock, nextMidnight, planStudy, validTimezone, type RetentionSnapshot } from "../lib/retention.ts";
import { InputError } from "../lib/api-input.ts";

export async function retentionClock(tx:Transaction,userId:string,now=Date.now(),zone?:string) {
 const requested=validTimezone(zone)?zone:undefined;
 await tx.execute({sql:"INSERT OR IGNORE INTO retention_state (user_id,day,day_end,timezone,pending_timezone) VALUES (?,0,?,?,?)",args:[userId,nextMidnight(now,requested||"Asia/Tokyo"),requested||"Asia/Tokyo",requested||"Asia/Tokyo"]});
 const row=(await tx.execute({sql:"SELECT * FROM retention_state WHERE user_id=?",args:[userId]})).rows[0];
 const clock=advanceClock({day:Number(row.day),end:Number(row.day_end),timezone:String(row.timezone),pendingTimezone:String(row.pending_timezone)},now,requested||String(row.pending_timezone));
 await tx.execute({sql:"UPDATE retention_state SET day=?,day_end=?,timezone=?,pending_timezone=? WHERE user_id=?",args:[clock.day,clock.end,clock.timezone,clock.pendingTimezone,userId]});
 return {...clock,reminderTime:String(row.reminder_time),reviewReminder:Boolean(row.review_reminder),streakWarning:Boolean(row.streak_warning)};
}
/** Called inside the same review/undo transaction. Completion cannot outlive its evidence. */
export async function reconcileStudy(tx:Transaction,userId:string,sessionId:string|null,now:string) {
 if(!sessionId)return;
 const profile=(await tx.execute({sql:"SELECT * FROM user_profiles WHERE user_id=? AND initial_session_id=?",args:[userId,sessionId]})).rows[0];
 if(profile)await tx.execute({sql:"INSERT OR IGNORE INTO study_sessions (user_id,id,set_id,card_ids,estimated_seconds,qualifies,onboarding,created_at) VALUES (?,?,?,?,0,1,1,?)",args:[userId,sessionId,profile.initial_set_id,profile.initial_card_ids,now]});
 const session=(await tx.execute({sql:"SELECT * FROM study_sessions WHERE user_id=? AND id=?",args:[userId,sessionId]})).rows[0];if(!session)return;
 const ids=JSON.parse(String(session.card_ids)) as string[];
 const answers=(await tx.execute({sql:"SELECT DISTINCT card_id FROM review_logs WHERE user_id=? AND session_id=? AND undone_at IS NULL AND (?=1 OR rating IN ('good','easy'))",args:[userId,sessionId,session.onboarding]})).rows.map(r=>String(r.card_id));
 const complete=ids.length>0&&ids.every(id=>answers.includes(id));
 if(complete&&!session.completed_at){const clock=await retentionClock(tx,userId,Date.parse(now));await tx.execute({sql:"UPDATE study_sessions SET completed_at=?,earned_day=? WHERE user_id=? AND id=?",args:[now,clock.day,userId,sessionId]});}
 if(!complete&&session.completed_at){await tx.execute({sql:"UPDATE study_sessions SET completed_at=NULL,earned_day=NULL WHERE user_id=? AND id=?",args:[userId,sessionId]});if(profile)await tx.execute({sql:"UPDATE user_profiles SET first_learning_completed_at=NULL WHERE user_id=?",args:[userId]});}
}
export async function startStudySession(userId:string,id:string,cardIds:string[],zone?:string) {
 await initializeDatabase();return database().transaction(async tx=>{
  await retentionClock(tx,userId,Date.now(),zone);
  const old=(await tx.execute({sql:"SELECT * FROM study_sessions WHERE user_id=? AND id=?",args:[userId,id]})).rows[0];
  if(old && (old.onboarding || (JSON.parse(String(old.card_ids)) as string[]).some((value,i)=>cardIds[i]!==value)))throw new InputError("セッションIDが別の操作に使われています。",409);
  if(old)return {id,cardIds:JSON.parse(String(old.card_ids)) as string[],estimatedSeconds:Number(old.estimated_seconds),qualifies:Boolean(old.qualifies)};
  const rows=(await tx.execute({sql:`SELECT * FROM cards WHERE user_id=? AND id IN (${cardIds.map(()=>"?").join(",")}) AND status NOT IN ('削除済み','アーカイブ')`,args:[userId,...cardIds]})).rows;
  if(rows.length!==cardIds.length)throw new InputError("学習対象が見つかりません。",404);
  const ordered=cardIds.map(id=>rows.find(r=>r.id===id)!).map(r=>({id:String(r.id),setId:String(r.set_id),question:String(r.question),answer:String(r.answer),format:String(r.format),difficulty:Number(r.difficulty)}));
  const plan=planStudy(ordered);const selected=plan.cards.map(c=>c.id);
  await tx.execute({sql:"INSERT INTO study_sessions (user_id,id,set_id,card_ids,estimated_seconds,qualifies,created_at) VALUES (?,?,?,?,?,?,?)",args:[userId,id,plan.cards[0].setId,JSON.stringify(selected),plan.estimatedSeconds,plan.qualifies?1:0,new Date().toISOString()]});
  return {id,cardIds:selected,estimatedSeconds:plan.estimatedSeconds,qualifies:plan.qualifies};
 });
}
export async function retentionSnapshot(userId:string,zone?:string,now=Date.now()):Promise<RetentionSnapshot> {
 await initializeDatabase();return database().transaction(async tx=>{
  const clock=await retentionClock(tx,userId,now,zone);
  const earned=(await tx.execute({sql:"SELECT DISTINCT earned_day FROM study_sessions WHERE user_id=? AND completed_at IS NOT NULL AND qualifies=1 AND earned_day<=? ORDER BY earned_day DESC",args:[userId,clock.day]})).rows.map(r=>Number(r.earned_day));
  const days=new Set(earned);let cursor=days.has(clock.day)?clock.day:clock.day-1,streak=0;while(days.has(cursor)){streak++;cursor--;}
  const due=(await tx.execute({sql:"SELECT id FROM cards WHERE user_id=? AND review_count>0 AND status NOT IN ('未学習','アーカイブ','削除済み') AND due_at<? ORDER BY due_at,id",args:[userId,new Date(clock.end).toISOString()]})).rows.map(r=>String(r.id));
  const interrupted=(await tx.execute({sql:"SELECT s.* FROM study_sessions s WHERE s.user_id=? AND s.completed_at IS NULL AND s.onboarding=0 AND NOT EXISTS (SELECT 1 FROM json_each(s.card_ids) j WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.id=j.value AND c.user_id=s.user_id AND c.status NOT IN ('アーカイブ','削除済み'))) ORDER BY s.created_at DESC LIMIT 1",args:[userId]})).rows[0];
  return {version:1,generatedAt:now,expiresAt:Math.min(clock.end,now+6*3600000),day:clock.day,dayEnd:clock.end,timezone:clock.timezone,achievedDays:earned.filter(d=>d>=clock.day-6),streak,hot:streak>=5,completed:days.has(clock.day),broken:earned.length>0&&streak===0,dueCount:due.length,dueCardIds:due,reminderTime:clock.reminderTime,reviewReminder:clock.reviewReminder,streakWarning:clock.streakWarning,...(interrupted?{session:{id:String(interrupted.id),setId:String(interrupted.set_id),cardIds:JSON.parse(String(interrupted.card_ids)) as string[]}}:{})};
 });
}
export async function saveRetentionPreferences(userId:string,input:{reminderTime:string;reviewReminder:boolean;streakWarning:boolean},zone?:string){
 await initializeDatabase();await database().transaction(async tx=>{await retentionClock(tx,userId,Date.now(),zone);await tx.execute({sql:"UPDATE retention_state SET reminder_time=?,review_reminder=?,streak_warning=? WHERE user_id=?",args:[input.reminderTime,+input.reviewReminder,+input.streakWarning,userId]});});
}

/** Shared policy: no database, credentials, or client-clock authority. */
export type WidgetState = "SIGNED_OUT"|"NEW_USER"|"NORMAL"|"AT_RISK"|"LAST_CHANCE"|"COMPLETED"|"BROKEN"|"STALE";
export type RetentionSnapshot = {
 version:1; generatedAt:number; expiresAt:number; day:number; dayEnd:number; timezone:string;
 achievedDays?:number[]; streak:number; hot:boolean; completed:boolean; broken:boolean; dueCount:number; dueCardIds:string[];
 reminderTime:string; reviewReminder:boolean; streakWarning:boolean;
 session?:{id:string;setId:string;cardIds:string[]};
};
export function validTimezone(value:unknown): value is string {
 if(typeof value!=="string" || value.length>100)return false;
 try {new Intl.DateTimeFormat("en",{timeZone:value}).format();return true;}catch{return false;}
}
export function localDate(ms:number, timezone:string) {
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(ms);
 return ["year","month","day"].map(k=>parts.find(p=>p.type===k)!.value).join("-");
}
/** Find the next actual local date boundary. Handles 23/25h DST and skipped dates. */
export function nextMidnight(ms:number,timezone:string):number {
 const date=localDate(ms,timezone);let lo=Math.floor(ms/1000),hi=lo+48*3600;
 while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(localDate(mid*1000,timezone)===date)lo=mid;else hi=mid;}
 return hi*1000;
}
export type DayClock={day:number;end:number;timezone:string;pendingTimezone:string};
/** Travel takes effect at the existing deadline, never creates a second "today". */
export function advanceClock(clock:DayClock,now:number,requested=clock.pendingTimezone):DayClock {
 const result={...clock,pendingTimezone:requested};
 while(now>=result.end){
  const moved=result.timezone!==result.pendingTimezone;
  result.timezone=result.pendingTimezone;
  // Bridge to the new zone's midnight as grace on the existing day. A timezone
  // switch must not create a one-hour day (or a second achievement opportunity).
  if(!moved || localDate(result.end-1,result.timezone)!==localDate(result.end,result.timezone))result.day++;
  result.end=nextMidnight(result.end,result.timezone);
 }
 return result;
}
export function widgetState(s:RetentionSnapshot|null,now:number):WidgetState {
 if(!s)return "SIGNED_OUT";if(now>=s.expiresAt||now>=s.dayEnd)return "STALE";
 if(s.completed)return "COMPLETED";if(s.broken)return "BROKEN";if(!s.streak)return "NEW_USER";
 const left=s.dayEnd-now;return left<=3*3600000?"LAST_CHANCE":left<=6*3600000?"AT_RISK":"NORMAL";
}
export function estimateCardSeconds(card:{question:string;answer:string;format:string;difficulty:number}):number {
 return Math.min(180,35+Math.ceil((card.question.length+card.answer.length)/6)+(card.format==="self_explain"?60:0)+card.difficulty*15);
}
export function planStudy<T extends {question:string;answer:string;format:string;difficulty:number}>(cards:T[]) {
 const selected:T[]=[];let estimatedSeconds=0;
 for(const card of cards){const cost=estimateCardSeconds(card);if(estimatedSeconds+cost>600)break;selected.push(card);estimatedSeconds+=cost;if(estimatedSeconds>=300)break;}
 return {cards:selected,estimatedSeconds,qualifies:estimatedSeconds>=300&&estimatedSeconds<=600};
}
export type Destination={kind:"onboarding"|"session"|"review"|"set"|"card"|"import"|"home";id?:string;setId?:string};
export function parseDeepLink(raw:string):Destination|null {
 try{const u=new URL(raw);if(u.protocol!=="patch:"||u.username||u.password||u.port||u.search||u.hash)return null;
 const path=u.host+u.pathname.replace(/\/$/,"");if(path==="continue")return {kind:"home"};if(path==="review/today")return {kind:"review"};
 const m=/^(set|card)\/([A-Za-z0-9_-]{1,160})$/.exec(path);return m?{kind:m[1] as "set"|"card",id:m[2]}:null;
 }catch{return null;}
}
export function notificationPlan(s:RetentionSnapshot,now:number) {
 const plan:{id:string;at:number;url:string;title:string}[]=[];
 // Snapshot proves today's count only; never repeat stale counts on future days.
 if(s.expiresAt<=now||s.dayEnd<=now)return plan;
 if(s.reviewReminder&&s.dueCount>0){
  const [h,m]=s.reminderTime.split(":").map(Number);
  for(let at=Math.ceil(now/60000)*60000;at<s.dayEnd;at+=60000){
   const parts=new Intl.DateTimeFormat("en-GB",{timeZone:s.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(at);
   if(Number(parts.find(p=>p.type==="hour")?.value)===h&&Number(parts.find(p=>p.type==="minute")?.value)===m){if(at>now)plan.push({id:`review-${s.day}`,at,url:"patch://review/today",title:`今日の復習は${s.dueCount}枚です`});break;}
  }
 }
 const warning=s.dayEnd-3*3600000;
 if(s.streakWarning&&s.streak>0&&!s.completed&&warning>now)plan.push({id:`streak-${s.day}`,at:warning,url:"patch://continue",title:"今日のPatchを続けよう。Streakの期限まであと3時間"});
 return plan;
}

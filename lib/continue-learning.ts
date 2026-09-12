import type { AppData } from "./types";
import { parseDeepLink, type Destination } from "./retention.ts";
import type { StudySession } from "./workspace";
export function continueLearning(data:AppData,sessions:StudySession[]):Destination {
 if(data.profile&&!data.profile.onboardingCompleted)return {kind:"onboarding"};
 const active=new Set(data.sets.flatMap(s=>s.cards.filter(c=>!["削除済み","アーカイブ"].includes(c.status)).map(c=>c.id)));
 const local=sessions.find(s=>s.id&&!s.done&&s.queue.some(id=>active.has(id)));
 if(local)return {kind:"session",id:local.id};
 if(data.retention?.session)return {kind:"session",id:data.retention.session.id};
 if(data.retention?.dueCount)return {kind:"review"};
 const recommended=data.sets.filter(s=>s.cards.some(c=>c.status==="未学習")&&s.lastStudiedAt).sort((a,b)=>String(b.lastStudiedAt).localeCompare(String(a.lastStudiedAt)))[0];
 if(recommended)return {kind:"set",id:recommended.id};
 const unlearned=data.sets.find(s=>s.cards.some(c=>c.status==="未学習"));if(unlearned)return {kind:"set",id:unlearned.id};
 return {kind:"import"};
}
export function resolveDeepLink(url:string,data:AppData,sessions:StudySession[]):Destination|null {
 const link=parseDeepLink(url);if(!link)return null;
 if(data.profile&&!data.profile.onboardingCompleted)return {kind:"onboarding"};
 if(link.kind==="home")return continueLearning(data,sessions);
 if(link.kind==="review")return data.retention?.dueCount?link:{kind:"home"};
 if(link.kind==="set")return data.sets.some(s=>s.id===link.id)?link:{kind:"home"};
 const set=data.sets.find(s=>s.cards.some(c=>c.id===link.id&&!["削除済み","アーカイブ"].includes(c.status)));
 return set?{...link,setId:set.id}:{kind:"home"};
}
export function acceptsPendingLink(link:{at:number;owner?:string},userId:string,now:number){return now-link.at>=0&&now-link.at<5*60000&&(!link.owner||link.owner===userId);}

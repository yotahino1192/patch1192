import { registerAccountCleanup } from "./account-cleanup";
import { notificationPlan, type RetentionSnapshot } from "./retention.ts";
export interface RetentionPlatform {
 activate(options:{userId:string}):Promise<void>;
 clear(options:{userId:string}):Promise<void>;
 publish(options:{userId:string;snapshot:Omit<RetentionSnapshot,"dueCardIds"|"session">;notifications:ReturnType<typeof notificationPlan>}):Promise<void>;
 signedOut?():Promise<void>;
 permission():Promise<{granted:boolean}>;
 links():Promise<{links:{url:string;owner?:string;at:number}[]}>;
}
let platform:RetentionPlatform|null=null,owner:string|null=null,epoch=0,latest=0;
let serial:Promise<unknown>=Promise.resolve();
const enqueue=<T>(fn:()=>Promise<T>):Promise<T>=>{const task=serial.then(fn,fn);serial=task.catch(()=>{});return task;};
export function configureRetention(value:RetentionPlatform){platform=value;}
export function nativeRetention(){return platform;}
export function activateRetention(userId:string){if(owner!==userId)latest=0;owner=userId;epoch++;return enqueue(async()=>{await platform?.activate({userId});});}
export function retentionOwner(){return owner;}
export function publishRetention(userId:string,snapshot:RetentionSnapshot){const ticket=epoch;return enqueue(async()=>{
 if(owner!==userId||ticket!==epoch||snapshot.generatedAt<latest)return;latest=snapshot.generatedAt;
 // Explicit allow-list: no card IDs, titles, text, email or credentials in App Group.
 const {version,generatedAt,expiresAt,day,dayEnd,timezone,streak,hot,completed,broken,dueCount,reminderTime,reviewReminder,streakWarning}=snapshot;
 await platform?.publish({userId,snapshot:{version,generatedAt,expiresAt,day,dayEnd,timezone,streak,hot,completed,broken,dueCount,reminderTime,reviewReminder,streakWarning},notifications:notificationPlan(snapshot,Date.now())});
});}
export async function clearRetention(userId:string){if(owner===userId){owner=null;epoch++;latest=0;}await enqueue(async()=>{await platform?.clear({userId});});}
registerAccountCleanup(clearRetention);

export function signedOutRetention(){owner=null;latest=0;const ticket=++epoch;return enqueue(async()=>{if(ticket===epoch&&owner===null)await platform?.signedOut?.();});}

import { clearAccountWorkspace } from "./account-storage";
export const privacyStopKey=(userId:string)=>`patch:privacy-stop:${userId}`;
type Cleanup=(userId:string)=>Promise<void>;
const hooks=new Set<Cleanup>();
// Retention/Widget/Notification register scoped cleanup here when implemented.
export function registerAccountCleanup(hook:Cleanup) { hooks.add(hook); return ()=>{hooks.delete(hook);}; }
export async function cleanupAccount(storage:Storage,userId:string,deleting=false) {
 clearAccountWorkspace(storage,userId);
 // Keep an unsynchronized withdrawal across logout; only deletion removes it.
 if(deleting)storage.removeItem(privacyStopKey(userId));
 const results=await Promise.allSettled([...hooks].map(h=>h(userId)));
 if(results.some(r=>r.status==="rejected")) throw new Error("ACCOUNT_CLEANUP_PENDING");
}

export const cleanupIntentKey=(sessionId:string)=>`patch:cleanup:${sessionId}`;
export async function resumeAccountCleanup(storage:Storage,sessionId:string) {
 const raw=storage.getItem(cleanupIntentKey(sessionId));if(!raw)return;
 const intent=JSON.parse(raw) as {userId:string;deleting:boolean};
 await cleanupAccount(storage,intent.userId,intent.deleting===true);
 storage.removeItem(cleanupIntentKey(sessionId));
}

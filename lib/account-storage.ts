import { EMPTY_WORKSPACE, parseWorkspace, type Workspace } from "./workspace";

export function workspaceKey(userId: string) {
  if (!/^[a-f0-9-]{36}$/.test(userId)) throw new Error("Invalid internal user ID");
  return `patch:workspace:v2:${userId}`;
}
export function readAccountWorkspace(storage: Pick<Storage, "getItem">, userId: string): Workspace {
  const raw = storage.getItem(workspaceKey(userId));
  if (!raw) return EMPTY_WORKSPACE;
  try {
    const envelope = JSON.parse(raw);
    return envelope.userId === userId ? parseWorkspace(JSON.stringify(envelope.workspace)) : EMPTY_WORKSPACE;
  } catch { return EMPTY_WORKSPACE; }
}
export function writeAccountWorkspace(storage: Pick<Storage, "setItem" | "getItem">, userId: string, workspace: Workspace) {
  const raw=storage.getItem(workspaceKey(userId));
  if(raw && isCorruptedWorkspace(raw,userId) && !storage.getItem(workspaceKey(userId)+':recovery')) {
    // Preserve one original, account-scoped copy before replacing malformed state. If full, fail safely.
    storage.setItem(workspaceKey(userId)+':recovery',raw);
  }
  storage.setItem(workspaceKey(userId), JSON.stringify({ userId, workspace }));
}
export function clearAccountWorkspace(storage: Pick<Storage, "removeItem">, userId: string) {
  storage.removeItem(workspaceKey(userId));
  storage.removeItem(workspaceKey(userId)+':recovery');
}

// This is a non-secret logout intent, not a token. Prevent restoring a session
// after an offline/failed sign-out; retry provider sign-out before private data.
export const logoutKey = (sessionId: string) => `patch:logout:${sessionId}`;

export function isCorruptedWorkspace(raw:string|null,userId:string):boolean {
 if(!raw)return false;
 try{
  const value=JSON.parse(raw),w=value?.workspace;
  if(!value || value.userId!==userId || !w || w.version!==1 || typeof w.importDraft?.text!=='string' || !Array.isArray(w.pausedSessions))return true;
  const parsed=parseWorkspace(JSON.stringify(w));
  return parsed.importDraft.text!==w.importDraft.text || (!!w.draft&&!parsed.draft) || (!!w.session&&!parsed.session) || (!!w.lastGeneration&&!parsed.lastGeneration) || parsed.pausedSessions.length!==w.pausedSessions.length;
 }
 catch{return true;}
}

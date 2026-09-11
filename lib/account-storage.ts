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
export function writeAccountWorkspace(storage: Pick<Storage, "setItem">, userId: string, workspace: Workspace) {
  storage.setItem(workspaceKey(userId), JSON.stringify({ userId, workspace }));
}
export function clearAccountWorkspace(storage: Pick<Storage, "removeItem">, userId: string) {
  storage.removeItem(workspaceKey(userId));
}

// This is a non-secret logout intent, not a token. Prevent restoring a session
// after an offline/failed sign-out; retry provider sign-out before private data.
export const logoutKey = (sessionId: string) => `patch:logout:${sessionId}`;

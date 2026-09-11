import { apiFetch, type ApiTransport } from "./api-client";

export type Identity = { subject: string; sessionId: string };
export type Account = Identity & { userId: string };
export type SessionTransport = { getToken?: () => Promise<string | null> };

export class StaleAccountError extends Error {
  constructor() { super("アカウントが変更されました。操作を再開してください。"); }
}

export function createAccountScope(account: Account, session: SessionTransport, transport: ApiTransport = apiFetch, onUnauthorized?: () => void) {
  let active = true;
  const pending = new Set<AbortController>();
  const assertCurrent = () => { if (!active) throw new StaleAccountError(); };
  const request: ApiTransport = async (path, options = {}) => {
    assertCurrent();
    const controller = new AbortController();
    pending.add(controller);
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      if (options.signal?.aborted) controller.abort();
      const headers = new Headers(options.headers);
      headers.set("X-Patch-Account", account.userId);
      headers.set("X-Patch-Session", account.sessionId);
      if (session.getToken) {
        const token = await session.getToken();
        assertCurrent();
        if (!token) { onUnauthorized?.(); throw new StaleAccountError(); }
        headers.set("Authorization", `Bearer ${token}`);
      }
      assertCurrent();
      const response = await transport(path, { ...options, headers, cache: "no-store", redirect: "error", credentials: session.getToken ? "omit" : "same-origin", signal: controller.signal });
      assertCurrent();
      if (response.status === 401 || (response.status === 409 && response.headers.get("x-patch-auth-error"))) onUnauthorized?.();
      const json = response.json.bind(response);
      response.json = async () => { const data = await json(); assertCurrent(); return data; };
      return response;
    } finally {
      options.signal?.removeEventListener("abort", abort);
      pending.delete(controller);
    }
  };
  return { account, request, assertCurrent, isCurrent: () => active, invalidate() { active = false; for (const controller of pending) controller.abort(); pending.clear(); } };
}
export type AccountScope = ReturnType<typeof createAccountScope>;

export async function loadAccount(identity: Identity, session: SessionTransport, transport: ApiTransport = apiFetch): Promise<Account> {
  const headers = new Headers({ "X-Patch-Session": identity.sessionId });
  if (session.getToken) {
    const token = await session.getToken();
    if (!token) throw new Error("ログインを確認してください。");
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await transport("/api/auth/session", { headers, cache: "no-store", redirect: "error", credentials: session.getToken ? "omit" : "same-origin" });
  if (!response.ok) throw new Error(response.status === 401 ? "ログインを確認してください。" : "アカウントを読み込めません。再試行してください。");
  const account = await response.json() as Account;
  if (account.subject !== identity.subject || account.sessionId !== identity.sessionId || !/^[a-f0-9-]{36}$/.test(account.userId)) throw new StaleAccountError();
  return account;
}

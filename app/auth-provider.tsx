"use client";

import { DeletionStatus } from "./deletion-status";
import { PrivacyProvider } from "./privacy-provider";
import { LegalLinks } from "./legal-content";
import { cleanupAccount, cleanupIntentKey, resumeAccountCleanup } from "../lib/account-cleanup";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccountContext } from "./account-context";
import { createAccountScope, loadAccount, type AccountScope, type Identity, type SessionTransport } from "../lib/account-scope";
import { logoutKey } from "../lib/account-storage";
import { getNativeAuth, type NativeAuth } from "../lib/auth-platform";

function AuthMessage({ children }: { children: ReactNode }) {
  return <main className="auth-screen"><section className="auth-card"><h1>Patch</h1><DeletionStatus/>{children}<LegalLinks /></section></main>;
}

export function AuthBoundary({ children, signUp = false }: { children?: ReactNode; signUp?: boolean }) {
  const native = getNativeAuth();
  if (native) return <NativeBoundary native={native}>{children}</NativeBoundary>;
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return <AuthMessage><p role="alert">ログインの設定が完了していません。</p></AuthMessage>;
  return <ClerkProvider publishableKey={key} signInUrl="/" signUpUrl="/sign-up" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
    <WebBoundary signUp={signUp}>{children}</WebBoundary>
  </ClerkProvider>;
}

// This owner survives the private subtree. A real account departure clears drafts;
// effect cleanup/reload only invalidates requests and preserves same-account drafts.
function useAccountDeparture(identity: Identity | null) {
  const owner = useRef<AccountScope | null>(null);
  useLayoutEffect(() => {
    if (owner.current && (!identity || owner.current.account.sessionId !== identity.sessionId || owner.current.account.subject !== identity.subject)) {
      owner.current.invalidate();
      try { void cleanupAccount(localStorage, owner.current.account.userId).catch(()=>{}); } catch { /* Namespaces still prevent another account from reading it. */ }
      owner.current = null;
    }
  }, [identity]);
  return useCallback((scope: AccountScope) => { owner.current = scope; }, []);
}

function WebBoundary({ children, signUp }: { children?: ReactNode; signUp: boolean }) {
  const { isLoaded, userId, sessionId } = useAuth();
  const clerk = useClerk();
  const identity = useMemo(() => userId && sessionId ? { subject: userId, sessionId } : null, [userId, sessionId]);
  const captureScope = useAccountDeparture(identity);
  const signOut = useCallback(async (id: string) => { await clerk.signOut({ sessionId: id }); }, [clerk]);
  const session = useMemo<SessionTransport>(() => ({}), []);
  const reauthenticate = async (code?:string) => {
    const current=clerk.session;
    if(!current||current.id!==identity?.sessionId)throw Error("Session changed");
    if(code){const result=await current.attemptFirstFactorVerification({strategy:"email_code",code});if(result.status!=="complete")throw Error("追加認証が必要です。");await current.getToken({skipCache:true});}
    else {const verification=await current.startVerification({level:"first_factor"});const factor=verification.supportedFirstFactors?.find(f=>f.strategy==="email_code");if(!factor||factor.strategy!=="email_code")throw Error("メールによる再認証を設定してください。");await current.prepareFirstFactorVerification({strategy:"email_code",emailAddressId:factor.emailAddressId});}
  };
  if (!isLoaded) return <AuthMessage><p>ログインを確認しています…</p></AuthMessage>;
  if (!identity) return <AuthMessage>{signUp ? <SignUp routing="hash" signInUrl="/" forceRedirectUrl="/" /> : <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/" />}</AuthMessage>;
  return <SessionBoundary email={clerk.user?.primaryEmailAddress?.emailAddress} reauthenticate={reauthenticate} key={identity.sessionId} captureScope={captureScope} identity={identity} session={session} signOut={signOut}>{children || <form action="/" method="get"><button>学習へ進む</button></form>}</SessionBoundary>;
}

function NativeBoundary({ native, children }: { native: NativeAuth; children?: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const accept = (next: Identity | null) => { if (active) { setIdentity(previous => previous?.sessionId === next?.sessionId && previous?.subject === next?.subject ? previous : next); setLoaded(true); setError(""); } };
    const unsubscribe = native.subscribe(accept);
    native.initialize().then(accept).catch(() => { if (active) setError("ログインを確認できません。通信と認証設定を確認して再試行してください。"); });
    const foreground = () => { if (document.visibilityState === "visible") native.getSession().then(accept).catch(() => { /* Preserve identity on temporary connection loss; APIs still verify credentials. */ }); };
    document.addEventListener("visibilitychange", foreground);
    return () => { active = false; unsubscribe(); document.removeEventListener("visibilitychange", foreground); };
  }, [native]);
  const captureScope = useAccountDeparture(identity);
  const session = useMemo<SessionTransport>(() => ({ getToken: () => identity ? native.getToken(identity.sessionId) : Promise.resolve(null) }), [identity, native]);
  const signOut = useCallback(async (id: string, deleting=false) => { await native.signOut(id,deleting); setIdentity(previous => previous?.sessionId === id ? null : previous); }, [native]);
  if (error) return <AuthMessage><p role="alert">{error}</p><button onClick={() => location.reload()}>再試行</button></AuthMessage>;
  if (!loaded) return <AuthMessage><p>ログインを確認しています…</p></AuthMessage>;
  if (!identity) return <EmailForm native={native} onSignedIn={setIdentity} />;
  return <SessionBoundary email={identity.email} reauthenticate={native.reauthenticate ? code=>native.reauthenticate!(identity.sessionId,code) : undefined} key={identity.sessionId} captureScope={captureScope} identity={identity} session={session} signOut={signOut}>{children}</SessionBoundary>;
}

function EmailForm({ native, onSignedIn }: { native: NativeAuth; onSignedIn: (identity: Identity | null) => void }) {
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <AuthMessage><h2>{signUp ? "アカウントを作成" : "ログイン"}</h2><form onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      if (!sent) { await native.startEmail(email.trim(), signUp); setSent(true); }
      else { const next = await native.verifyEmail(code.trim(), signUp); if (!next) throw new Error("追加の認証が必要です。ClerkのEmail認証設定を確認してください。"); onSignedIn(next); }
    } catch (e) { setError(e instanceof Error ? e.message : "ログインできませんでした。"); }
    finally { setBusy(false); }
  }}>
    <label>メールアドレス<input type="email" autoComplete="email" required value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} /></label>
    {sent && <label>確認コード<input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={e => setCode(e.target.value)} /></label>}
    {error && <p role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? "確認中…" : sent ? "確認して続ける" : "確認コードを送信"}</button>
    {sent && <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); setError(""); }}>メールアドレスの変更・再送信</button>}
    <button type="button" disabled={busy} onClick={() => { setSignUp(!signUp); setSent(false); setCode(""); setError(""); }}>{signUp ? "ログインに戻る" : "新規登録"}</button>
  </form></AuthMessage>;
}

function SessionBoundary({ identity, session, signOut, captureScope, children, email, reauthenticate }: { email?:string; reauthenticate?:(code?:string)=>Promise<void>; captureScope: (scope: AccountScope) => void; identity: Identity; session: SessionTransport; signOut: (id: string, deleting?:boolean) => Promise<void>; children: ReactNode }) {
  const [scope, setScope] = useState<AccountScope | null>(null);
  const current = useRef<AccountScope | null>(null);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Layout cleanup runs at account departure, before another private tree can act.
  useLayoutEffect(() => () => { current.current?.invalidate(); }, []);
  useEffect(() => {
    let active = true;
    let owned: AccountScope | null = null;
    const bootstrap = async () => {
      if (localStorage.getItem(logoutKey(identity.sessionId))) {
        await resumeAccountCleanup(localStorage,identity.sessionId);
        await signOut(identity.sessionId,localStorage.getItem(logoutKey(identity.sessionId))==="deleting");
        localStorage.removeItem(logoutKey(identity.sessionId));
        return;
      }
      const account = await loadAccount(identity, session);
      if (!active) return;
      owned = createAccountScope(account, session, undefined, reason => {
        owned?.invalidate(); setError("ログインを再確認してください。");
        if(reason && ["ACCOUNT_DELETED","ACCOUNT_DELETING","ACCOUNT_INACTIVE"].includes(reason)) {
          // A different device has accepted deletion: lock and purge on next contact.
          setLoggingOut(true);
          const purge=async()=>{
            localStorage.setItem(logoutKey(identity.sessionId),"deleting");
            localStorage.setItem(cleanupIntentKey(identity.sessionId),JSON.stringify({userId:account.userId,deleting:true}));
            await resumeAccountCleanup(localStorage,identity.sessionId);
            await signOut(identity.sessionId,true);
            localStorage.removeItem(logoutKey(identity.sessionId));
          };
          void purge().catch(()=>setError("このアカウントは利用できません。端末内データの消去を再試行してください。"));
        }
      });
      current.current = owned; captureScope(owned);
      setScope(owned); setError("");
    };
    bootstrap().catch(e => { if (active) setError(e instanceof Error ? e.message : "ログインを確認できません。"); });
    return () => { active = false; owned?.invalidate(); };
  }, [identity, session, signOut, captureScope, attempt]);

  const logout = useCallback(async (deleting=false) => {
    const departing = current.current;
    departing?.invalidate(); setLoggingOut(true); setError("");
    try {
      // Mark before the network call so an interrupted logout cannot restore private data.
      deleting=deleting || localStorage.getItem(logoutKey(identity.sessionId))==="deleting";
      localStorage.setItem(logoutKey(identity.sessionId), deleting ? "deleting" : "pending");
      if (departing)localStorage.setItem(cleanupIntentKey(identity.sessionId),JSON.stringify({userId:departing.account.userId,deleting}));
      await resumeAccountCleanup(localStorage,identity.sessionId);
      await signOut(identity.sessionId,deleting);
      localStorage.removeItem(logoutKey(identity.sessionId));
    } catch { setError("ログアウトを完了できません。接続を確認して再試行してください。学習画面はロックされています。"); }
  }, [identity.sessionId, signOut]);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === logoutKey(identity.sessionId) && event.newValue) {
        current.current?.invalidate(); setLoggingOut(true); void logout();
      }
    };
    const pageShown = (event: PageTransitionEvent) => { if (event.persisted) { current.current?.invalidate(); location.reload(); } };
    window.addEventListener("storage", changed); window.addEventListener("pageshow", pageShown);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("pageshow", pageShown); };
  }, [identity.sessionId, logout]);

  if (loggingOut) return <AuthMessage><p role={error ? "alert" : "status"}>{error || "ログアウトしています…"}</p>{error && <button onClick={() => void logout()}>ログアウトを再試行</button>}</AuthMessage>;
  if (error) return <AuthMessage><p role="alert">{error}</p><button onClick={() => { setError(""); setAttempt(n => n + 1); }}>再試行</button><button onClick={() => void logout()}>ログアウト</button></AuthMessage>;
  if (!scope?.isCurrent() || scope.account.sessionId !== identity.sessionId) return <AuthMessage><p>アカウントを準備しています…</p></AuthMessage>;
  return <AccountContext.Provider value={{ scope, logout, email, reauthenticate }}><PrivacyProvider key={scope.account.userId + scope.account.sessionId}><div>{children}</div></PrivacyProvider></AccountContext.Provider>;
}

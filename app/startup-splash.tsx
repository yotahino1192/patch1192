"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Mascot } from "./mascot";

// Presentation-only lifetime: survives account subtree changes, never persists
// account/session data, and ends at the first real screen (including recovery).
const StartupContext = createContext({ starting: false, finish: () => {} });
export function StartupProvider({ children }: { children: ReactNode }) {
  const [starting, setStarting] = useState(true);
  const finish = useCallback(() => setStarting(false), []);
  const value = useMemo(() => ({ starting, finish }), [starting, finish]);
  return <StartupContext.Provider value={value}>{children}</StartupContext.Provider>;
}
export function useStartup() { return useContext(StartupContext); }
export function useStartupReady(ready: boolean) {
  const { finish } = useStartup();
  useEffect(() => { if (ready) finish(); }, [ready, finish]);
}
export function StartupComplete({ children }: { children: ReactNode }) {
  useStartupReady(true);
  return children;
}
export function StartupSplash() {
  return <main className="patch-startup" aria-label="Patch" aria-busy="true">
    <div className="patch-startup-brand"><Mascot pose="hello" /><span className="patch-startup-wordmark">Patch</span></div>
  </main>;
}
export function StartupPending({ fallback, pending = true }: { fallback: ReactNode; pending?: boolean }) {
  const { starting } = useStartup();
  return starting && pending ? <StartupSplash /> : fallback;
}

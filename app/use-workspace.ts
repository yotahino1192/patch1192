"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { EMPTY_WORKSPACE, type Workspace } from "../lib/workspace";

import { useAccount } from "./account-context";
import { isCorruptedWorkspace, workspaceKey, readAccountWorkspace, writeAccountWorkspace } from "../lib/account-storage";

export function useWorkspace() {
  const scope = useAccount()?.scope;
  const mounted = useRef(false);
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [recoveryWarning,setRecoveryWarning]=useState(false);
  const latest = useRef(workspace);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    // Hydrate after the server render, without writing defaults over saved work.
    Promise.resolve().then(() => {
      if (!active || !scope?.isCurrent()) return;
      try { setRecoveryWarning(isCorruptedWorkspace(localStorage.getItem(workspaceKey(scope.account.userId)),scope.account.userId) || !!localStorage.getItem(workspaceKey(scope.account.userId)+':recovery')); latest.current = readAccountWorkspace(localStorage, scope.account.userId); }
      catch { setSaveError(true); }
      setWorkspace(latest.current);
      setReady(true);
    });
    return () => { active = false; mounted.current = false; };
  }, [scope]);
  const update = useCallback((action: SetStateAction<Workspace>) => {
    if (!mounted.current || !scope?.isCurrent()) return;
    const next = typeof action === "function" ? action(latest.current) : action;
    latest.current = next;
    setWorkspace(next);
    // Save each edit immediately; reloads and navigation do not depend on a timer.
    try { writeAccountWorkspace(localStorage, scope.account.userId, next); setSaveError(false); }
    catch { setSaveError(true); }
  }, [scope]);
  const getWorkspace = useCallback(() => latest.current, []);
  const ensureDurable = useCallback(() => {
    if (!scope?.isCurrent()) throw new Error('アカウントが変更されました。');
    try { writeAccountWorkspace(localStorage, scope.account.userId, latest.current); setSaveError(false); }
    catch { setSaveError(true); throw new Error('途中の状態を保存できません。端末の空き容量を確認して再試行してください。'); }
  }, [scope]);
  return { ensureDurable, getWorkspace, workspace, setWorkspace: update, workspaceReady: ready, saveError:saveError||recoveryWarning };
}

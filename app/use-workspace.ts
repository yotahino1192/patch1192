"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { EMPTY_WORKSPACE, type Workspace } from "../lib/workspace";

import { useAccount } from "./account-context";
import { readAccountWorkspace, writeAccountWorkspace } from "../lib/account-storage";

export function useWorkspace() {
  const scope = useAccount()?.scope;
  const mounted = useRef(false);
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const latest = useRef(workspace);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    // Hydrate after the server render, without writing defaults over saved work.
    Promise.resolve().then(() => {
      if (!active || !scope?.isCurrent()) return;
      try { latest.current = readAccountWorkspace(localStorage, scope.account.userId); }
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
  return { getWorkspace, workspace, setWorkspace: update, workspaceReady: ready, saveError };
}

"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { EMPTY_WORKSPACE, WORKSPACE_KEY, parseWorkspace, type Workspace } from "../lib/workspace";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const latest = useRef(workspace);
  useEffect(() => {
    let active = true;
    // Hydrate after the server render, without writing defaults over saved work.
    Promise.resolve().then(() => {
      if (!active) return;
      try { latest.current = parseWorkspace(localStorage.getItem(WORKSPACE_KEY)); }
      catch { setSaveError(true); }
      setWorkspace(latest.current);
      setReady(true);
    });
    return () => { active = false; };
  }, []);
  const update = useCallback((action: SetStateAction<Workspace>) => {
    const next = typeof action === "function" ? action(latest.current) : action;
    latest.current = next;
    setWorkspace(next);
    // Save each edit immediately; reloads and navigation do not depend on a timer.
    try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next)); setSaveError(false); }
    catch { setSaveError(true); }
  }, []);
  const getWorkspace = useCallback(() => latest.current, []);
  return { getWorkspace, workspace, setWorkspace: update, workspaceReady: ready, saveError };
}

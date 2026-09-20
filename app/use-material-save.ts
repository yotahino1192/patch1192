"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { EMPTY_IMPORT, type Workspace } from '../lib/workspace';
import { materialSaveInput, reviewError, type SavedMaterial } from '../lib/material-save';
import type { AppData } from '../lib/types';

type Api = <T>(url: string, options?: RequestInit) => Promise<T>;
export function useMaterialSave(getWorkspace: () => Workspace, setWorkspace: Dispatch<SetStateAction<Workspace>>, api: Api, onSaved: (data: AppData, saved: SavedMaterial) => void) {
  const active = useRef(false), lock = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const save = async (data: AppData) => {
    if (lock.current) return;
    const w = getWorkspace();
    let pending = w.pendingMaterialSave;
    if (!pending) {
      const invalid = reviewError(w.draft, w.destination, data.sets.map(s => s.id));
      if (invalid || !w.draft) { setError(invalid); return; }
      pending = { operationId: crypto.randomUUID(), payload: materialSaveInput(w.draft, w.destination) };
      setWorkspace(current => ({ ...current, pendingMaterialSave: pending }));
    }
    lock.current = true; setSaving(true); setError('');
    const operation = pending;
    try {
      const result = await api<{ setId: string; cardIds: string[]; data: AppData }>('/api/data', { method: 'POST', body: JSON.stringify({ ...operation.payload, operationId: operation.operationId }) });
      if (!active.current || getWorkspace().pendingMaterialSave?.operationId !== operation.operationId) return;
      const set = result.data.sets.find(s => s.id === result.setId);
      if (!set || !Array.isArray(result.cardIds) || !result.cardIds.length) throw new Error('Invalid save response');
      const saved = { setId: result.setId, cardIds: result.cardIds, title: set.title, appended: operation.payload.action === 'addCardsToSet' };
      setWorkspace(current => ({ ...current, draft: null, destination: 'root', importDraft: EMPTY_IMPORT, lastGeneration: null, pendingMaterialSave: undefined }));
      onSaved(result.data, saved);
    } catch (failure) {
      if (!active.current || getWorkspace().pendingMaterialSave?.operationId !== operation.operationId) return;
      const status = failure && typeof failure === 'object' && 'status' in failure ? failure.status : undefined;
      // These responses reject before writing. Unknown outcomes retain the exact request for safe replay.
      if ([400, 401, 403, 404, 409, 413, 415].includes(Number(status))) {
        setWorkspace(current => ({ ...current, pendingMaterialSave: undefined }));
        setError('We could not save this Patch. Check your name, destination and connection, then try again.');
      } else setError('We could not confirm the save. Your draft is safe. Retry the same save to check it without creating a duplicate.');
    } finally { lock.current = false; if (active.current) setSaving(false); }
  };
  return { save, saving, error };
}

"use client";
import { buildGenerationError } from '../lib/build-generation-error';
import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { generationInput, normalizeBuildDraft } from '../lib/build-draft';
import type { Workspace } from '../lib/workspace';
import type { GeneratedMaterial } from '../lib/types';
import { reviewContentError } from '../lib/material-save';

type Api = <T>(url: string, options?: RequestInit) => Promise<T>;
// Lives with the account workspace, so leaving a step never starts another job.
export function useBuildGeneration(getWorkspace: () => Workspace, setWorkspace: Dispatch<SetStateAction<Workspace>>, api: Api, language: 'ja' | 'en') {
  const active = useRef(true);
  const inFlight = useRef(false);
  const [running, setRunning] = useState(false);
  const currentLanguage = useRef(language);
  useEffect(() => { currentLanguage.current = language; }, [language]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = async (force = false) => {
    if (inFlight.current) return;
    const initial = getWorkspace();
    if (initial.pendingMaterialSave) return;
    const input = generationInput(initial.importDraft, language);
    const fingerprint = JSON.stringify(input);
    const build = normalizeBuildDraft(initial.importDraft.build, initial.destination);
    if (!force && initial.draft && !reviewContentError(initial.draft) && build.generation.status === 'succeeded' && build.generation.fingerprint === fingerprint) {
      setWorkspace(w => ({ ...w, importDraft: { ...w.importDraft, build: { ...build, step: 'review' } } }));
      return;
    }
    const key = !force && build.generation.status !== 'succeeded' && build.generation.fingerprint === fingerprint && build.generation.key ? build.generation.key : crypto.randomUUID();
    inFlight.current = true;
    setRunning(true);
    setWorkspace(w => ({ ...w, importDraft: { ...w.importDraft, build: { ...build, step: 'preparing', generation: { status: 'running', key, fingerprint } } } }));
    const current = () => {
      if (!active.current || currentLanguage.current !== language) return false;
      const w = getWorkspace();
      if (w.importDraft.build?.generation.key !== key) return false;
      try { return JSON.stringify(generationInput(w.importDraft, language)) === fingerprint; } catch { return false; }
    };
    try {
      const material = await api<GeneratedMaterial>('/api/ai/cards', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ ...input, operationId: key }) });
      if (!current()) return;
      setWorkspace(w => ({ ...w,
        draft: { ...material, sourceContent: input.text, cards: material.cards.map(card => ({ ...card, draftId: crypto.randomUUID(), selected: true })) },
        lastGeneration: { text: input.text, detail: input.detail, style: input.style },
        importDraft: { ...w.importDraft, build: { ...normalizeBuildDraft(w.importDraft.build), step: 'review', generation: { status: 'succeeded', key, fingerprint } } },
      }));
    } catch (error) {
      if (!current()) return;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const kind = error && typeof error === 'object' && 'kind' in error ? String(error.kind) : error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : error instanceof TypeError ? 'network' : '';
      const terminal = ['AI_REQUEST_CANCELLED', 'AI_REQUEST_FINAL', 'AI_RESULT_EXPIRED', 'AI_PROVIDER_FAILED', 'AI_NOT_CONFIGURED', 'AI_PRE_DISPATCH_FAILED'].includes(code);
      setWorkspace(w => ({ ...w, importDraft: { ...w.importDraft, build: { ...normalizeBuildDraft(w.importDraft.build), step: 'preparing', generation: {
        status: 'failed', key: terminal ? undefined : key, fingerprint,
        error: buildGenerationError(code, kind),
      } } } }));
    } finally { inFlight.current = false; if (active.current) setRunning(false); }
  };
  return { run, isRunning: () => running };
}

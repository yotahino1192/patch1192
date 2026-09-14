import type { RecordAttempt } from '../../lib/domain/types';
import type { ActivityState } from './contracts';
import { registerAccountCleanup } from '../../lib/account-cleanup';

export type LessonCheckpoint = {
  lessonId: string; activityId?: string; revision?: string; draft?: ActivityState;
  elapsedSeconds?: number; pending?: RecordAttempt | null;
};
export type CheckpointStore = ReturnType<typeof createLessonCheckpoint>;
export const lessonCheckpointKey = (userId: string) => `patch:lesson:${userId}`;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
export function parseLessonCheckpoint(raw: string | null, userId: string): LessonCheckpoint | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw), c = value.checkpoint;
    if (value.version !== 1 || value.userId !== userId || !c || !id(c.lessonId)) return null;
    if (c.elapsedSeconds !== undefined && (!Number.isSafeInteger(c.elapsedSeconds) || c.elapsedSeconds < 0)) return null;
    if (c.draft && (!id(c.activityId) || typeof c.revision !== 'string' || !['READY','ANSWERING','ERROR'].includes(c.draft.status) || typeof c.draft.response !== 'string' || c.draft.response.length > 12000 || typeof c.draft.revealed !== 'boolean' || c.draft.assessment !== undefined && !['CORRECT','INCORRECT'].includes(c.draft.assessment))) return null;
    const p = c.pending;
    if (p && (p.lessonId !== c.lessonId || !id(p.activityId) || !id(p.operationId) || !['COMPLETED','CORRECT','INCORRECT'].includes(p.result) || typeof p.response !== 'string' || p.response.length > 12000 || !Number.isInteger(p.durationMs) || p.durationMs < 0 || p.durationMs > 3600000)) return null;
    return c;
  } catch { return null; }
}
/** One active lesson draft per account. Each write re-reads to preserve pending receipt updates. */
export function createLessonCheckpoint(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, userId: string, assertCurrent: () => void) {
  const key = lessonCheckpointKey(userId);
  const read = (lessonId: string) => { assertCurrent(); const c = parseLessonCheckpoint(storage.getItem(key), userId); return c?.lessonId === lessonId ? c : null; };
  return {
    read,
    write(lessonId: string, patch: Partial<LessonCheckpoint>) {
      const checkpoint = { ...read(lessonId), ...patch, lessonId };
      assertCurrent(); storage.setItem(key, JSON.stringify({ version: 1, userId, checkpoint }));
    },
    clear(lessonId: string) { if (read(lessonId)) storage.removeItem(key); },
  };
}
// Module registration survives feature unmount, so later logout/deletion still removes the draft.
registerAccountCleanup(async userId => { globalThis.localStorage?.removeItem(lessonCheckpointKey(userId)); });

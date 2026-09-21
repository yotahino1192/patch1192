import type { ImportDraft } from './workspace';
import { MIN_SOURCE_LENGTH, MAX_SOURCE_LENGTH, MAX_FOCUS_LENGTH } from './material-limits.ts';

export type BuildDraft = {
  step: 1 | 2 | 3 | 'preparing' | 'review';
  destinationMode: 'new' | 'existing';
  existingPatchId: string;
  coverage: 'whole' | 'focus';
  focus: string;
  generation: { status: 'idle' | 'running' | 'failed' | 'succeeded'; key?: string; fingerprint?: string; error?: string };
};
export function normalizeBuildDraft(value?: unknown, destination = 'root'): BuildDraft {
  const v = value && typeof value === 'object' ? value as Partial<BuildDraft> : {};
  const g = v.generation;
  return {
    step: [1, 2, 3, 'preparing', 'review'].includes(v.step ?? '') ? v.step! : 1,
    destinationMode: v.destinationMode === 'existing' || (!v.destinationMode && destination.startsWith('set:')) ? 'existing' : 'new',
    existingPatchId: typeof v.existingPatchId === 'string' ? v.existingPatchId : destination.startsWith('set:') ? destination.slice(4) : '',
    coverage: v.coverage === 'focus' ? 'focus' : 'whole', focus: typeof v.focus === 'string' ? v.focus : '',
    generation: g && ['idle', 'running', 'failed', 'succeeded'].includes(g.status) ? { status: g.status, key: typeof g.key === 'string' ? g.key : undefined, fingerprint: typeof g.fingerprint === 'string' ? g.fingerprint : undefined, error: typeof g.error === 'string' ? g.error : undefined } : { status: 'idle' },
  };
}
export function materialSource(draft: ImportDraft) {
  return [draft.text.trim(), ...draft.attachments.filter(a => !a.status || a.status === 'accepted').map(a => a.text.trim())].filter(Boolean).join('\n\n');
}
export function materialError(draft: ImportDraft): string {
  if (draft.attachments.some(a => a.status === 'reading')) return 'Please wait while your files are checked.';
  const length = materialSource(draft).length;
  if (draft.inputKind === 'topic') {
    if (draft.attachments.length) return 'Use source material mode for uploaded files.';
    if (!length || length > 200) return 'Enter a topic of 1–200 characters.';
    return '';
  }
  if (length < MIN_SOURCE_LENGTH) return `Add at least ${MIN_SOURCE_LENGTH} characters of source material. Choose Topic for a short topic.`;
  if (length > MAX_SOURCE_LENGTH) return 'Text and accepted files together must be at most 30,000 characters.';
  return '';
}
export function generationInput(draft: ImportDraft, language: 'ja' | 'en') {
  const build = normalizeBuildDraft(draft.build);
  const error = materialError(draft);
  if (error) throw new Error(error);
  if (draft.inputKind !== 'topic' && build.coverage === 'focus' && (!build.focus.trim() || build.focus.length > MAX_FOCUS_LENGTH)) throw new Error('Enter your focus (up to 1,000 characters).');
  return { ...(draft.inputKind === "topic" ? { inputKind: "topic" as const } : {}), text: materialSource(draft), detail: draft.detail, style: draft.style, language, ...(draft.inputKind !== 'topic' && build.coverage === 'focus' ? { focus: build.focus.trim() } : {}) };
}

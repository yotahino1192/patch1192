import type { AppData, GeneratedCard, GeneratedMaterial } from "./types";

export type DraftCard = GeneratedCard & { draftId: string; selected: boolean };
export type DraftMaterial = Omit<GeneratedMaterial, "cards"> & { sourceContent: string; cards: DraftCard[] };
export type ImportDraft = {
  text: string; detail: string; style: string;
  attachments: { id: string; name: string; text: string }[];
};
export type StudyUndo = {
  reviewId: string; queue: string[]; remaining: string[]; mistakes: number;
  flipped: boolean; selectedChoice: string | null; aiInput: string; aiOpen: boolean; aiCompose: boolean;
  batchSize: number; batchTotal: number; batchDone: boolean;
};
export type StudyEdit = { cardId: string; question: string; answer: string; choices: string[] };
export type StudyReturnTarget = { screen: "home" } | { screen: "sets"; setId: string };
export type PendingReview = { operationId: string; cardId: string; rating: "again" | "good"; responseMs: number; expectedReviewCount: number };
export type StudySession = {
  pendingReview?: PendingReview | null;
  id: string; scope: string; setId: string | null; queue: string[]; total: number; mistakes: number;
  flipped: boolean; done: boolean; selectedChoice: string | null;
  aiInput: string; aiOpen: boolean; aiCompose: boolean;
  batchSize?: number; batchTotal?: number; batchDone?: boolean; remaining?: string[];
  undo?: StudyUndo | null; editDraft?: StudyEdit | null;
  returnTo?: StudyReturnTarget;
};
export type Workspace = {
  version: 1; importDraft: ImportDraft; destination: string; draft: DraftMaterial | null;
  lastGeneration: { text: string; detail: string; style: string } | null;
  session: StudySession | null; pausedSessions: StudySession[];
};
export const WORKSPACE_KEY = "loop-workspace-v1";
export const EMPTY_IMPORT: ImportDraft = { text: "", detail: "標準", style: "一問一答", attachments: [] };
export const EMPTY_SESSION: StudySession = { id: "", scope: "", setId: null, queue: [], total: 0, mistakes: 0, flipped: false, done: false, selectedChoice: null, aiInput: "", aiOpen: false, aiCompose: false };
export const EMPTY_WORKSPACE: Workspace = { version: 1, importDraft: EMPTY_IMPORT, destination: "root", draft: null, lastGeneration: null, session: null, pausedSessions: [] };

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === "string");
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
function validSession(value: unknown): value is StudySession {
  return record(value) && typeof value.id === "string" && Boolean(value.id) && typeof value.scope === "string" && (value.setId === null || typeof value.setId === "string") && strings(value.queue) && count(value.total) && count(value.mistakes) && [value.flipped, value.done, value.aiOpen, value.aiCompose].every((v) => typeof v === "boolean") && (value.selectedChoice === null || typeof value.selectedChoice === "string") && typeof value.aiInput === "string";
}
function normalizeSession(session: StudySession): StudySession {
  const undo = session.undo;
  const edit = session.editDraft;
  const returnTo = session.returnTo;
  const pending = session.pendingReview;
  const { pendingReview: _pending, undo: _undo, editDraft: _edit, batchSize: _size, remaining: _remaining, batchTotal: _total, batchDone: _done, returnTo: _returnTo, ...base } = session;
  return { ...base,
    ...(record(pending) && typeof pending.operationId === "string" && pending.operationId.length > 0 && pending.operationId.length <= 120 && typeof pending.cardId === "string" && ["again", "good"].includes(String(pending.rating)) && count(pending.expectedReviewCount) && count(pending.responseMs) ? { pendingReview: pending as PendingReview } : {}),
    ...(record(returnTo) && (returnTo.screen === "home" || (returnTo.screen === "sets" && typeof returnTo.setId === "string" && returnTo.setId)) ? { returnTo } : {}),
    ...(session.batchSize === 5 && strings(session.remaining) && count(session.batchTotal) ? { batchSize: 5, remaining: session.remaining, batchTotal: session.batchTotal, batchDone: Boolean(session.batchDone) } : {}),
    ...(record(undo) && typeof undo.reviewId === "string" && strings(undo.queue) && strings(undo.remaining) && count(undo.mistakes) && count(undo.batchTotal) && [0, 5].includes(Number(undo.batchSize)) && typeof undo.flipped === "boolean" && (undo.selectedChoice === null || typeof undo.selectedChoice === "string") && typeof undo.aiInput === "string" && typeof undo.aiOpen === "boolean" && typeof undo.aiCompose === "boolean" && typeof undo.batchDone === "boolean" ? { undo } : {}),
    ...(record(edit) && [edit.cardId, edit.question, edit.answer].every((v) => typeof v === "string") && strings(edit.choices) ? { editDraft: edit } : {}),
  };
}
function validDraft(value: unknown): value is DraftMaterial {
  return record(value) && [value.title, value.category, value.summary, value.sourceContent].every((v) => typeof v === "string") && strings(value.keyPoints) && Array.isArray(value.cards) && value.cards.every((c) => record(c) && [c.question, c.answer, c.draftId].every((v) => typeof v === "string") && typeof c.selected === "boolean" && typeof c.difficulty === "number" && ["qa", "multiple_choice", "self_explain"].includes(String(c.format)) && strings(c.choices));
}
export function parseWorkspace(raw: string | null): Workspace {
  if (!raw) return EMPTY_WORKSPACE;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1) return EMPTY_WORKSPACE;
    const draft = value.importDraft;
    const generation = value.lastGeneration;
    return {
      version: 1,
      importDraft: record(draft) && typeof draft.text === "string" && typeof draft.detail === "string" && typeof draft.style === "string" && Array.isArray(draft.attachments) && draft.attachments.every((a) => record(a) && [a.id, a.name, a.text].every((v) => typeof v === "string")) ? draft as ImportDraft : EMPTY_IMPORT,
      destination: typeof value.destination === "string" ? value.destination : "root",
      draft: validDraft(value.draft) ? value.draft : null,
      lastGeneration: record(generation) && [generation.text, generation.detail, generation.style].every((v) => typeof v === "string") ? generation as Workspace["lastGeneration"] : null,
      session: validSession(value.session) ? normalizeSession(value.session) : null,
      pausedSessions: Array.isArray(value.pausedSessions) ? value.pausedSessions.filter(validSession).map(normalizeSession) : [],
    };
  } catch { return EMPTY_WORKSPACE; }
}

// A reload can happen after the server saved an answer, before the animation finished.
// Reconcile with durable reviews so that answer is never submitted a second time.
export function reconcileSession(session: StudySession, data: AppData): StudySession {
  if (session.undo && data.undoneReviewIds?.includes(session.undo.reviewId)) session = restoreStudyUndo(session);
  if (session.pendingReview && data.undoneOperationIds?.includes(session.pendingReview.operationId)) session = { ...session, pendingReview: null };
  const reviews = (data.sessionReviews ?? data.reviews).filter((review) => review.sessionId === session.id);
  const introductory = data.profile?.initialSessionId === session.id && !data.profile.onboardingCompleted;
  const pending = session.pendingReview;
  const delivered = pending && reviews.find((review) => review.operationId === pending.operationId);
  if (delivered && session.queue[0] === pending?.cardId) {
    session = { ...session, undo: studyUndoCheckpoint(session, delivered.id), pendingReview: null,
      queue: delivered.rating === "again" && !introductory ? [...session.queue.slice(1), session.queue[0]] : session.queue.slice(1),
      mistakes: session.mistakes + (delivered.rating === "again" ? 1 : 0),
      flipped: false, selectedChoice: null, aiInput: "", aiOpen: false, aiCompose: false };
  }
  const active = new Map(data.sets.flatMap((set) => set.cards).filter((card) => !["削除済み", "アーカイブ"].includes(card.status)).map((card) => [card.id, card]));
  const finished = new Set(reviews.filter((review) => (introductory || ["good", "easy"].includes(review.rating))).map((review) => review.cardId));
  if (session.pendingReview && !delivered && active.get(session.pendingReview.cardId)?.reviewCount !== session.pendingReview.expectedReviewCount) session = { ...session, pendingReview: null, flipped: false, selectedChoice: null };
  const availableQueue = [...new Set(session.queue)].filter((id) => active.has(id));
  const queue = availableQueue.filter((id) => !finished.has(id));
  const availableRemaining = [...new Set(session.remaining || [])].filter((id) => active.has(id));
  const remaining = availableRemaining.filter((id) => !finished.has(id));
  const first = active.get(queue[0]);
  const sameCard = queue[0] === session.queue[0];
  const selectedChoice = sameCard && first?.choices.includes(session.selectedChoice ?? "") ? session.selectedChoice : null;
  return {
    ...session, queue, total: Math.max(queue.length + remaining.length, session.total - (session.queue.length - availableQueue.length) - ((session.remaining?.length || 0) - availableRemaining.length)),
    done: !queue.length && !remaining.length,
    ...(session.batchSize ? { remaining, batchDone: !queue.length && remaining.length > 0, batchTotal: Math.max(queue.length, (session.batchTotal || session.queue.length) - (session.queue.length - availableQueue.length)) } : {}),
    ...(session.editDraft && (!sameCard || session.editDraft.cardId !== queue[0]) ? { editDraft: null } : {}),
    mistakes: Math.max(session.mistakes, reviews.filter((review) => review.rating === "again").length),
    flipped: sameCard && session.flipped && (first?.format !== "multiple_choice" || selectedChoice !== null),
    selectedChoice, aiInput: sameCard ? session.aiInput : "", aiOpen: sameCard && session.aiOpen, aiCompose: sameCard && session.aiCompose,
  };
}
export function reconcileWorkspace(workspace: Workspace, data: AppData): Workspace {
  const destination = workspace.destination;
  const validDestination = destination === "root" || (destination.startsWith("folder:") && data.folders.some((f) => f.id === destination.slice(7))) || (destination.startsWith("set:") && data.sets.some((s) => s.id === destination.slice(4)));
  return { ...workspace, destination: validDestination ? destination : "root", session: workspace.session ? reconcileSession(workspace.session, data) : null, pausedSessions: workspace.pausedSessions.map((s) => reconcileSession(s, data)).filter((s) => !s.done) };
}
export function activateSession(workspace: Workspace, session: StudySession): Workspace {
  const previous = workspace.session;
  const pausedSessions = workspace.pausedSessions.filter((s) => s.id !== session.id && s.id !== previous?.id && !s.done);
  if (previous && previous.id !== session.id && !previous.done && pendingStudyCount(previous)) pausedSessions.push(previous);
  return { ...workspace, session, pausedSessions };
}

export function pendingStudyCount(session: StudySession): number { return session.queue.length + (session.remaining?.length || 0); }

export function studyReturnTarget(screen: string, setId: string | null, saved?: StudyReturnTarget): StudyReturnTarget {
  if (screen === "sets" && setId) return { screen: "sets", setId };
  if (screen === "study" && saved) return saved;
  return { screen: "home" };
}

export function resolveStudyReturn(session: StudySession, data: Pick<AppData, "sets">): StudyReturnTarget {
  const target = session.returnTo;
  return target?.screen === "sets" && data.sets.some((set) => set.id === target.setId) ? target : { screen: "home" };
}
export function startStudyBatch(session: StudySession, size = 5): StudySession {
  const pending = [...session.queue, ...(session.remaining || [])];
  return { ...session, queue: pending.slice(0, size), remaining: pending.slice(size), batchSize: size, batchTotal: Math.min(size, pending.length), batchDone: false, done: !pending.length };
}
export function nextStudyBatch(session: StudySession): StudySession {
  return startStudyBatch({ ...session, flipped: false, selectedChoice: null, aiOpen: false, aiInput: "", aiCompose: false }, session.batchSize || 5);
}
export function studyUndoCheckpoint(session: StudySession, reviewId: string): StudyUndo {
  return { reviewId, queue: [...session.queue], remaining: [...(session.remaining || [])], mistakes: session.mistakes, flipped: session.flipped, selectedChoice: session.selectedChoice, aiInput: session.aiInput, aiOpen: session.aiOpen, aiCompose: session.aiCompose, batchSize: session.batchSize || 0, batchTotal: session.batchTotal || session.total, batchDone: Boolean(session.batchDone) };
}
export function restoreStudyUndo(session: StudySession): StudySession {
  if (!session.undo) return session;
  const { reviewId: _reviewId, ...before } = session.undo;
  return { ...session, ...before, done: false, undo: null, editDraft: null, ...(session.pendingReview ? { pendingReview: null } : {}) };
}

export function workspaceSessionIds(workspace: Workspace): string[] {
  return [...new Set([workspace.session, ...workspace.pausedSessions].filter((session): session is StudySession => Boolean(session?.id)).map((session) => session.id))];
}

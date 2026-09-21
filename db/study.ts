import { createHash } from 'node:crypto';
import type { Transaction } from '@libsql/client';
import { database } from './client';
import { studyContent } from '../lib/study/content.ts';
import type { StudyContent, StudyResponse, StudySessionView } from '../lib/study/types';
import { InputError } from '../lib/api-input.ts';
export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function persistedContent(row: Record<string, unknown>): StudyContent {
  let choices: unknown;
  try { choices = JSON.parse(String(row.choices)); } catch { choices = []; }
  return studyContent({ question: String(row.question || ''), answer: String(row.answer || ''), format: String(row.format),
    choices: Array.isArray(choices) && choices.every(c => typeof c === 'string') ? choices : [] });
}
export function contentRevision(row: Record<string, unknown>) { return fingerprint(persistedContent(row)); }
/** Explanation may finish after Continue, but must still belong to an owned assignment. */
export async function requireExplanationCard(tx: Transaction, userId: string, setId: string, cardId: string, sessionId: string) {
  const card = (await tx.execute({sql:`SELECT c.* FROM cards c JOIN card_sets p ON p.id=c.set_id AND p.user_id=c.user_id
    WHERE c.user_id=? AND c.set_id=? AND c.id=? AND c.status NOT IN ('アーカイブ','削除済み')
    AND (EXISTS (SELECT 1 FROM study_sessions s,json_each(s.card_ids) j
      WHERE s.user_id=c.user_id AND s.id=? AND s.patch_id IS NULL AND j.value=c.id)
      OR EXISTS (SELECT 1 FROM user_profiles p,json_each(p.initial_card_ids) j
        WHERE p.user_id=c.user_id AND p.initial_session_id=? AND j.value=c.id))`,args:[userId,setId,cardId,sessionId,sessionId]})).rows[0];
  if (!card) throw new Error('CARD_NOT_FOUND');
  return card;
}
export function readResponse(value: unknown): StudyResponse | null {
  if (!value) return null;
  return JSON.parse(String(value)) as StudyResponse;
}
export async function readStudySession(tx: Transaction, userId: string, id: string): Promise<StudySessionView | null> {
  const session = (await tx.execute({sql:'SELECT s.*,c.title FROM study_sessions s LEFT JOIN card_sets c ON c.id=s.set_id AND c.user_id=s.user_id WHERE s.user_id=? AND s.id=? AND s.patch_id IS NULL',args:[userId,id]})).rows[0];
  if (!session) return null;
  const cardIds = JSON.parse(String(session.card_ids)) as string[];
  const reviews = (await tx.execute({sql:'SELECT * FROM review_logs WHERE user_id=? AND session_id=? AND undone_at IS NULL ORDER BY rowid',args:[userId,id]})).rows;
  const results = reviews.filter(r => cardIds.includes(String(r.card_id))).map(r => ({id:String(r.id),cardId:String(r.card_id),rating:String(r.rating) as 'good'|'again',response:readResponse(r.response_json),reviewedAt:String(r.reviewed_at),operationId:r.operation_id?String(r.operation_id):null}));
  const processed = new Set(results.map(r=>r.cardId));
  const remainingIds = cardIds.filter(id=>!processed.has(id));
  const cards = (await tx.execute({sql:`SELECT c.* FROM cards c JOIN card_sets p ON p.id=c.set_id AND p.user_id=c.user_id WHERE c.user_id=? AND c.id IN (${cardIds.map(()=>'?').join(',') || 'NULL'})`,args:[userId,...cardIds]})).rows;
  const unavailable = !cardIds.length || remainingIds.some(id=>!cards.some(c=>c.id===id && !['アーカイブ','削除済み'].includes(String(c.status)) && persistedContent(c).question && persistedContent(c).answer && ['qa','multiple_choice','self_explain'].includes(persistedContent(c).format)));
  return {id,setId:String(session.set_id),title:String(session.title||'Patch'),cardIds,remainingIds,currentItemId:remainingIds[0]??null,processed:processed.size,total:cardIds.length,
    status:session.completed_at?'COMPLETED':unavailable?'UNAVAILABLE':'ACTIVE',completedAt:session.completed_at?String(session.completed_at):null,qualifies:Boolean(session.qualifies),results};
}
export async function loadStudyViews(userId: string, requested: string[]) {
  return database().transaction(async tx=>{
    const historyIds = (await tx.execute({sql:'SELECT id FROM study_sessions WHERE user_id=? AND patch_id IS NULL AND completed_at IS NOT NULL ORDER BY completed_at DESC,id LIMIT 50',args:[userId]})).rows.map(r=>String(r.id));
    const views = await Promise.all([...new Set([...requested,...historyIds])].map(id=>readStudySession(tx,userId,id)));
    const valid = views.filter((v):v is StudySessionView=>v!==null);
    return { studySessions:valid.filter(v=>requested.includes(v.id)),studyHistory:historyIds.map(id=>valid.find(v=>v.id===id)!).filter(Boolean) };
  });
}
/** Applies to authenticated API submissions, including old clients. Never accept a bare session ID. */
export async function requireStudyAssignment(tx: Transaction, userId: string, sessionId: string, cardId: string) {
  let session = (await tx.execute({sql:'SELECT * FROM study_sessions WHERE user_id=? AND id=?',args:[userId,sessionId]})).rows[0];
  if (!session) {
    const profile = (await tx.execute({sql:'SELECT * FROM user_profiles WHERE user_id=? AND initial_session_id=?',args:[userId,sessionId]})).rows[0];
    if (profile) {
      await tx.execute({sql:'INSERT OR IGNORE INTO study_sessions (user_id,id,set_id,card_ids,estimated_seconds,qualifies,onboarding,created_at) VALUES (?,?,?,?,0,1,1,?)',args:[userId,sessionId,profile.initial_set_id,profile.initial_card_ids,new Date().toISOString()]});
      session = (await tx.execute({sql:'SELECT * FROM study_sessions WHERE user_id=? AND id=?',args:[userId,sessionId]})).rows[0];
    }
  }
  if (!session || session.patch_id || !(JSON.parse(String(session.card_ids)) as string[]).includes(cardId)) throw new InputError('学習セッションの対象ではありません。',404);
  if (session.completed_at) throw new Error('REVIEW_STATE_CONFLICT');
  const view = await readStudySession(tx,userId,sessionId);
  if (view?.status==='UNAVAILABLE') throw new InputError('教材が変更されています。新しい学習セッションを開始してください。',409);
  if (view?.currentItemId!==cardId) throw new Error('REVIEW_STATE_CONFLICT');
}

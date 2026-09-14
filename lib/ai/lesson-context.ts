import type { Transaction } from '@libsql/client';
import { AiError } from './execution.ts';
import { CONSENT_SCOPE } from '../privacy-policy.ts';

/** Uses the same transaction for membership checks at admission and finalization. */
export async function lessonHelpContext(tx: Transaction, userId: string, lessonId: string, activityId: string) {
  const row = (await tx.execute({ sql: `SELECT a.prompt,a.answer,a.explanation,a.type,p.title,p.id AS patch_id,o.description
    FROM study_sessions s JOIN lesson_activities la ON la.user_id=s.user_id AND la.lesson_id=s.id
    JOIN activities a ON a.user_id=la.user_id AND a.id=la.activity_id
    JOIN learning_objectives o ON o.user_id=a.user_id AND o.id=a.objective_id
    JOIN patches p ON p.user_id=o.user_id AND p.id=o.patch_id
    WHERE s.user_id=? AND s.id=? AND a.id=? AND s.patch_id=p.id
    AND s.status='ACTIVE' AND p.status='ACTIVE' AND o.status='ACTIVE'`, args: [userId, lessonId, activityId] })).rows[0];
  if (!row) throw new AiError('LESSON_UNAVAILABLE', 404);
  return row;
}

/** Existing expiring AI receipts are sufficient for short contextual follow-ups; no chat tables. */
export async function loadLessonHelp(tx: Transaction, userId: string, lessonId: string, activityId: string) {
  const context = await lessonHelpContext(tx, userId, lessonId, activityId);
  const sources = (await tx.execute({ sql: 'SELECT title,substr(content,1,1200) AS content FROM sources WHERE user_id=? AND patch_id=? ORDER BY created_at,id LIMIT 2', args: [userId, context.patch_id] })).rows;
  const receipts = (await tx.execute({ sql: `SELECT r.result_json FROM ai_requests r
    JOIN users u ON u.id=r.user_id JOIN user_consents c ON c.user_id=r.user_id AND c.scope=?
    WHERE r.user_id=? AND r.endpoint='chat' AND r.state='succeeded'
      AND r.result_until>CAST(strftime('%s','now') AS INTEGER)*1000
      AND r.generation=u.generation AND r.consent_revision=c.revision
      AND json_extract(r.result_json,'$.lessonHelp.lessonId')=?
      AND json_extract(r.result_json,'$.lessonHelp.activityId')=?
    ORDER BY r.created_at DESC,r.rowid DESC LIMIT 3`, args: [CONSENT_SCOPE, userId, lessonId, activityId] })).rows;
  const history = receipts.reverse().flatMap(row => {
    const receipt = JSON.parse(String(row.result_json)) as { answer: string; lessonHelp: { question: string } };
    return [{ role: 'user' as const, content: receipt.lessonHelp.question.slice(0, 600) }, { role: 'assistant' as const, content: receipt.answer.slice(0, 900) }];
  });
  return { context, sources, history };
}

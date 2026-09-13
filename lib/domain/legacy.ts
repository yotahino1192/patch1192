import type { LegacyCard, LegacyReview, SessionRecord } from './repository.ts';
import type { Lesson, NewActivity } from './types.ts';
/** Read adapter only: old sessions remain owned by existing review/undo/Retention. */
export function asLesson(row:SessionRecord):Lesson {
  return {id:row.id,patchId:row.patchId,targetMinutes:row.targetMinutes,status:(row.status??(row.completedAt?'COMPLETED':'ACTIVE')) as Lesson['status'],startedAt:row.startedAt??(row.patchId?null:row.createdAt),completedAt:row.completedAt,createdAt:row.createdAt,estimatedSeconds:row.estimatedSeconds,legacyCardIds:JSON.parse(row.cardIds),legacySetId:row.setId,legacy:row.patchId===null};
}
export function cardActivity(card:LegacyCard,objectiveId:string):NewActivity {
  const type=card.format==='multiple_choice'?'CHOICE':card.format==='self_explain'?'EXPLAIN':'RECALL';
  return {objectiveId,type,prompt:card.question,answer:card.answer,explanation:'',estimatedSeconds:type==='EXPLAIN'?120:60,metadata:type==='CHOICE'?{choices:JSON.parse(card.choices)}:{}};
}
/** No dual write or fake Activity ID: provenance stays explicit, Undo is observed on re-read. */
export function legacyReviewView(review:LegacyReview) {
  if(review.undoneAt)return null;
  return {kind:'LEGACY_REVIEW' as const,reviewLogId:review.id,legacyCardId:review.cardId,rating:review.rating,response:null,durationMs:review.durationMs,createdAt:review.reviewedAt,operationId:review.operationId};
}

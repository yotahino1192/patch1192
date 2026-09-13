import type { Patch, Source, LearningObjective, Activity, Attempt, LessonActivity, ObjectiveState } from '../lib/domain/types.ts';
import type { InValue, Transaction } from '@libsql/client';
import type { DomainRepositories, DomainUnitOfWork, Repository, SessionRecord, LegacySet, LegacyCard, LegacyReview } from '../lib/domain/repository.ts';
import { DomainError } from '../lib/domain/validation.ts';
import type { createDatabase } from './client.ts';

type Columns<T> = {[K in keyof T]:string};
/** SQL identifiers only come from these closed, server-owned maps, never HTTP input. */
function repository<T extends object>(tx:Transaction,ownerId:string,table:string,columns:Columns<T>,jsonKeys:string[]=[],order='rowid'):Repository<T> {
  const entries=Object.entries(columns) as [keyof T,string][];
  const encode=(key:keyof T,value:unknown):InValue=>jsonKeys.includes(String(key))?JSON.stringify(value):value as InValue;
  const where=(filter:Partial<T>)=>{
    const selected=entries.filter(([key])=>Object.hasOwn(filter,key));
    return {sql:['user_id=?',...selected.map(([key,col])=>`"${col}" ${filter[key]===null?'IS NULL':'=?'}`)].join(' AND '),args:[ownerId,...selected.filter(([key])=>filter[key]!==null).map(([key])=>encode(key,filter[key]))] as InValue[]};
  };
  return {
    async list(filter={}) {
      const w=where(filter),rows=(await tx.execute({sql:`SELECT ${entries.map(([key,col])=>`"${col}" AS "${String(key)}"`).join(',')} FROM ${table} WHERE ${w.sql} ORDER BY ${order}`,args:w.args})).rows;
      return rows.map(row=>{const result={...row};for(const key of jsonKeys)result[key]=JSON.parse(String(result[key]));return result as T;});
    },
    async find(filter){return (await this.list(filter))[0]??null;},
    async insert(value){
      const fields=entries.filter(([,col])=>col!=='user_id');
      await tx.execute({sql:`INSERT INTO ${table} (user_id,${fields.map(([,col])=>`"${col}"`).join(',')}) VALUES (${fields.map(()=>'?').concat('?').join(',')})`,args:[ownerId,...fields.map(([key])=>encode(key,value[key]))]});
    },
    async update(filter,changes){
      const fields=entries.filter(([key,col])=>col!=='user_id'&&Object.hasOwn(changes,key));if(!fields.length)return 0;
      const w=where(filter);return (await tx.execute({sql:`UPDATE ${table} SET ${fields.map(([,col])=>`"${col}"=?`).join(',')} WHERE ${w.sql}`,args:[...fields.map(([key])=>encode(key,changes[key])),...w.args]})).rowsAffected;
    },
  };
}
export function createDomainUnitOfWork(db:ReturnType<typeof createDatabase>):DomainUnitOfWork {
 return {run:async(ownerId,action)=>db.transaction(async tx=>{
   const user=(await tx.execute({sql:'SELECT lifecycle_state FROM users WHERE id=?',args:[ownerId]})).rows[0];
   if(ownerId==='loop-owner'||user?.lifecycle_state!=='active')throw new DomainError('ACCOUNT_INACTIVE',403);
   const repositories:DomainRepositories={
     patches:repository<Patch>(tx,ownerId,'patches',{id:'id',ownerId:'user_id',title:'title',mode:'mode',status:'status',legacySetId:'legacy_set_id',createdAt:'created_at',updatedAt:'updated_at'}),
     sources:repository<Source>(tx,ownerId,'sources',{id:'id',patchId:'patch_id',title:'title',content:'content',createdAt:'created_at',updatedAt:'updated_at'}),
     objectives:repository<LearningObjective>(tx,ownerId,'learning_objectives',{id:'id',patchId:'patch_id',description:'description',objectiveType:'objective_type',difficulty:'difficulty',status:'status',createdAt:'created_at',updatedAt:'updated_at'}),
     activities:repository<Activity>(tx,ownerId,'activities',{id:'id',objectiveId:'objective_id',type:'type',prompt:'prompt',answer:'answer',explanation:'explanation',estimatedSeconds:'estimated_seconds',metadata:'metadata',legacyCardId:'legacy_card_id',createdAt:'created_at',updatedAt:'updated_at'},['metadata']),
     lessons:repository<SessionRecord>(tx,ownerId,'study_sessions',{id:'id',patchId:'patch_id',targetMinutes:'target_minutes',status:'status',startedAt:'started_at',completedAt:'completed_at',createdAt:'created_at',estimatedSeconds:'estimated_seconds',cardIds:'card_ids',setId:'set_id',qualifies:'qualifies',onboarding:'onboarding',earnedDay:'earned_day'}),
     lessonActivities:repository<LessonActivity>(tx,ownerId,'lesson_activities',{lessonId:'lesson_id',activityId:'activity_id',order:'position',estimatedSeconds:'estimated_seconds'},[],'position'),
     attempts:repository<Attempt>(tx,ownerId,'attempts',{id:'id',userId:'user_id',activityId:'activity_id',lessonId:'lesson_id',result:'result',response:'response',durationMs:'duration_ms',createdAt:'created_at',operationId:'operation_id',payloadHash:'payload_hash',undoneAt:'undone_at'}),
     objectiveStates:repository<ObjectiveState>(tx,ownerId,'objective_states',{userId:'user_id',objectiveId:'objective_id',mastery:'mastery',incorrectCount:'incorrect_count',lastReviewedAt:'last_reviewed_at',nextReviewAt:'next_review_at',updatedAt:'updated_at',version:'version'}),
     legacySets:repository<LegacySet>(tx,ownerId,'card_sets',{id:'id',title:'title',sourceId:'source_id'}),
     legacyCards:repository<LegacyCard>(tx,ownerId,'cards',{id:'id',setId:'set_id',question:'question',answer:'answer',format:'format',choices:'choices',difficulty:'difficulty',status:'status'}),
     legacyReviews:repository<LegacyReview>(tx,ownerId,'review_logs',{id:'id',cardId:'card_id',rating:'rating',reviewedAt:'reviewed_at',durationMs:'response_ms',operationId:'operation_id',undoneAt:'undone_at'}),
   };
   return action(repositories);
 })};
}

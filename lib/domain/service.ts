import { createHash, randomUUID } from 'node:crypto';
import type { DomainRepositories, DomainUnitOfWork, Repository, SessionRecord } from './repository.ts';
import type { Activity, Attempt, CommandResults, DomainCommand, DomainQuery, LearningObjective, Patch, QueryResults } from './types.ts';
import { ensure, validateCommand, validateQuery } from './validation.ts';
import { asLesson, cardActivity, legacyReviewView } from './legacy.ts';

async function requireRow<T>(repo:Repository<T>,where:Partial<T>):Promise<T> {
  const row=await repo.find(where);ensure(row,'NOT_FOUND',404);return row;
}
async function activePatch(r:DomainRepositories,id:string) {
  const patch=await requireRow(r.patches,{id});ensure(patch.status==='ACTIVE','PATCH_ARCHIVED',409);return patch;
}
async function activeObjective(r:DomainRepositories,id:string) {
  const objective=await requireRow(r.objectives,{id});ensure(objective.status==='ACTIVE','OBJECTIVE_ARCHIVED',409);await activePatch(r,objective.patchId);return objective;
}
async function nativeLesson(r:DomainRepositories,id:string) {
  const lesson=await requireRow(r.lessons,{id});ensure(lesson.patchId,'LEGACY_SESSION_READ_ONLY',409);return lesson;
}
async function lessonComplete(r:DomainRepositories,lessonId:string) {
  const assignments=await r.lessonActivities.list({lessonId});
  const attempts=await r.attempts.list({lessonId,undoneAt:null});
  const latest=new Map(attempts.map(a=>[a.activityId,a]));
  return assignments.length>0&&assignments.every(a=>{const result=latest.get(a.activityId)?.result;return result==='CORRECT'||result==='COMPLETED';});
}
/** Application service. Every command, including replay and Undo, has one owner/lifecycle-checked transaction. */
export function createDomainService(unit:DomainUnitOfWork) {
 async function execute(ownerId:string,raw:unknown):Promise<CommandResults[keyof CommandResults]> {
  const command=validateCommand(raw);
  return unit.run(ownerId,async r=>{
   const now=new Date().toISOString(),id=randomUUID();
   switch(command.action) {
    case 'createPatch': {
      const patch:Patch={...command.input,id,ownerId,status:'ACTIVE',legacySetId:null,createdAt:now,updatedAt:now};await r.patches.insert(patch);return patch;
    }
    case 'createSource': {
      await activePatch(r,command.input.patchId);const source={...command.input,id,createdAt:now,updatedAt:now};await r.sources.insert(source);return source;
    }
    case 'attachSource': {
      const {patchId,sourceId}=command.input;await activePatch(r,patchId);const source=await requireRow(r.sources,{id:sourceId});
      ensure(source.patchId===null||source.patchId===patchId,'SOURCE_ALREADY_ASSIGNED',409);const next={...source,patchId,updatedAt:now};await r.sources.update({id:sourceId},next);return next;
    }
    case 'createObjective': {
      await activePatch(r,command.input.patchId);const objective:LearningObjective={...command.input,id,status:'ACTIVE',createdAt:now,updatedAt:now};await r.objectives.insert(objective);return objective;
    }
    case 'createActivity': {
      await activeObjective(r,command.input.objectiveId);const activity:Activity={...command.input,id,legacyCardId:null,createdAt:now,updatedAt:now};await r.activities.insert(activity);return activity;
    }
    case 'createLesson': {
      const {patchId,targetMinutes,activityIds}=command.input;await activePatch(r,patchId);
      const activities=[];
      for(const activityId of activityIds) {const activity=await requireRow(r.activities,{id:activityId});const objective=await activeObjective(r,activity.objectiveId);ensure(objective.patchId===patchId,'ACTIVITY_PATCH_MISMATCH');activities.push(activity);}
      const estimatedSeconds=activities.reduce((sum,a)=>sum+a.estimatedSeconds,0);
      ensure(estimatedSeconds>=300&&estimatedSeconds<=900,'LESSON_DURATION_OUT_OF_RANGE');
      const lesson:SessionRecord={id,patchId,targetMinutes,status:'CREATED',startedAt:null,completedAt:null,createdAt:now,estimatedSeconds,cardIds:'[]',setId:`domain:${patchId}`,qualifies:0,onboarding:0,earnedDay:null};
      await r.lessons.insert(lesson);
      for(const [order,activity] of activities.entries())await r.lessonActivities.insert({lessonId:id,activityId:activity.id,order,estimatedSeconds:activity.estimatedSeconds});
      return asLesson(lesson);
    }
    case 'startLesson':case 'completeLesson':case 'abandonLesson': {
      const lesson=await nativeLesson(r,command.input.lessonId);
      await activePatch(r,lesson.patchId!);
      if(command.action==='startLesson') {
        ensure(lesson.status==='CREATED'||lesson.status==='ACTIVE','LESSON_TRANSITION_CONFLICT',409);
        if(lesson.status==='CREATED'){lesson.status='ACTIVE';lesson.startedAt=now;}
      } else if(command.action==='abandonLesson') {
        ensure(lesson.status!=='COMPLETED','LESSON_TRANSITION_CONFLICT',409);lesson.status='ABANDONED';
      } else {
        ensure(lesson.status==='ACTIVE'||lesson.status==='COMPLETED','LESSON_TRANSITION_CONFLICT',409);
        ensure(await lessonComplete(r,lesson.id),'LESSON_INCOMPLETE',409);
        lesson.status='COMPLETED';lesson.completedAt??=now;
      }
      await r.lessons.update({id:lesson.id},lesson);return asLesson(lesson);
    }
    case 'recordAttempt': {
      const v=command.input;
      // Fixed field order: JSON key ordering cannot turn a replay into another operation.
      const payloadHash=createHash('sha256').update(JSON.stringify([v.activityId,v.lessonId??null,v.result,v.response,v.durationMs])).digest('hex');
      const old=await r.attempts.find({operationId:v.operationId});
      if(old){ensure(old.payloadHash===payloadHash,'OPERATION_CONFLICT',409);return old;}
      const activity=await requireRow(r.activities,{id:v.activityId});await activeObjective(r,activity.objectiveId);
      ensure(activity.type==='LEARN'?v.result==='COMPLETED':v.result!=='COMPLETED','INVALID_ACTIVITY_RESULT');
      if(v.lessonId) {
        const lesson=await nativeLesson(r,v.lessonId);ensure(lesson.status==='ACTIVE','LESSON_NOT_ACTIVE',409);
        await requireRow(r.lessonActivities,{lessonId:v.lessonId,activityId:v.activityId});
      }
      const attempt:Attempt={...v,id,userId:ownerId,lessonId:v.lessonId??null,payloadHash,createdAt:now,undoneAt:null};
      await r.attempts.insert(attempt);return attempt;
    }
    case 'undoAttempt': {
      const attempt=await requireRow(r.attempts,{id:command.input.attemptId});if(attempt.undoneAt)return attempt;
      const active=await r.attempts.list({activityId:attempt.activityId,lessonId:attempt.lessonId,undoneAt:null});
      ensure(active.at(-1)?.id===attempt.id,'UNDO_NOT_LATEST',409);
      attempt.undoneAt=now;await r.attempts.update({id:attempt.id},{undoneAt:now});
      if(attempt.lessonId){const lesson=await nativeLesson(r,attempt.lessonId);if(lesson.status==='COMPLETED'&&!(await lessonComplete(r,lesson.id)))await r.lessons.update({id:lesson.id},{status:'ACTIVE',completedAt:null});}
      return attempt;
    }
    case 'writeObjectiveState': {
      const {expectedVersion,...input}=command.input;await activeObjective(r,input.objectiveId);
      const old=await r.objectiveStates.find({objectiveId:input.objectiveId});ensure((old?.version??0)===expectedVersion,'STATE_VERSION_CONFLICT',409);
      const next={...input,userId:ownerId,updatedAt:now,version:expectedVersion+1};
      if(old)await r.objectiveStates.update({objectiveId:input.objectiveId,version:expectedVersion},next);else await r.objectiveStates.insert(next);return next;
    }
    case 'importLegacySet': {
      const {setId}=command.input;const old=await r.patches.find({legacySetId:setId});if(old)return old;
      const set=await r.legacySets.find({id:setId});ensure(set,'NOT_FOUND',404);
      const patch:Patch={id,ownerId,title:set.title,mode:'MATERIAL',status:'ACTIVE',legacySetId:setId,createdAt:now,updatedAt:now};await r.patches.insert(patch);
      if(set.sourceId){const source=await requireRow(r.sources,{id:set.sourceId});ensure(!source.patchId,'SOURCE_ALREADY_ASSIGNED',409);await r.sources.update({id:source.id},{patchId:id,updatedAt:now});}
      for(const card of await r.legacyCards.list({setId})) {
        if(['削除済み','アーカイブ'].includes(card.status))continue;
        const objective:LearningObjective={id:randomUUID(),patchId:id,description:card.question,objectiveType:'LEGACY_CARD',difficulty:card.difficulty,status:'ACTIVE',createdAt:now,updatedAt:now};await r.objectives.insert(objective);
        const input=cardActivity(card,objective.id);validateCommand({action:'createActivity',input});
        await r.activities.insert({...input,id:randomUUID(),legacyCardId:card.id,createdAt:now,updatedAt:now});
      }
      return patch;
    }
   }
  });
 }
 return {
  command:execute as <C extends DomainCommand>(ownerId:string,command:C)=>Promise<CommandResults[C['action']]>,
  async query<Q extends DomainQuery>(ownerId:string,raw:Q):Promise<QueryResults[Q['resource']]> {
   const query=validateQuery(raw);
   return unit.run(ownerId,async r=>{
    switch(query.resource) {
     case 'patches':return r.patches.list();
     case 'patch':return requireRow(r.patches,{id:query.id});
     case 'sources':await requireRow(r.patches,{id:query.id});return r.sources.list({patchId:query.id});
     case 'objectives':await requireRow(r.patches,{id:query.id});return r.objectives.list({patchId:query.id});
     case 'lessons':await requireRow(r.patches,{id:query.id});return (await r.lessons.list({patchId:query.id})).map(asLesson);
     case 'activities':await requireRow(r.objectives,{id:query.id});return r.activities.list({objectiveId:query.id});
     case 'lesson':return asLesson(await requireRow(r.lessons,{id:query.id}));
     case 'lessonActivities':await requireRow(r.lessons,{id:query.id});return r.lessonActivities.list({lessonId:query.id});
     case 'attempts':await requireRow(r.activities,{id:query.id});return r.attempts.list({activityId:query.id});
     case 'objectiveState':await requireRow(r.objectives,{id:query.id});return r.objectiveStates.find({objectiveId:query.id});
    }
   }) as Promise<QueryResults[Q['resource']]>;
  },
  async legacyHistory(ownerId:string,cardId:string) {
    return unit.run(ownerId,async r=>{ensure(await r.legacyCards.find({id:cardId}),'NOT_FOUND',404);return (await r.legacyReviews.list({cardId})).map(legacyReviewView).filter(v=>v!==null);});
  },
 };
}

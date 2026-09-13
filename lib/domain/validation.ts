import { ACTIVITY_TYPES, type DomainCommand, type DomainQuery } from './types.ts';
export class DomainError extends Error {
  code:string; status:number;
  constructor(code:string, status=400) { super(code); this.code=code; this.status=status; }
}
export function ensure(condition:unknown, code='INVALID_DOMAIN_INPUT', status=400):asserts condition {
  if (!condition) throw new DomainError(code,status);
}
function object(value:unknown):Record<string,unknown> {
  ensure(value && typeof value==='object' && !Array.isArray(value) && (Object.getPrototypeOf(value)===Object.prototype || Object.getPrototypeOf(value)===null));
  return value as Record<string,unknown>;
}
const id=(v:unknown)=>typeof v==='string' && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
const text=(v:unknown,max:number,empty=false)=>typeof v==='string' && v.length<=max && (empty||v.trim().length>0);
const integer=(v:unknown,min:number,max:number)=>typeof v==='number' && Number.isInteger(v) && v>=min && v<=max;
const date=(v:unknown)=>v===null || (typeof v==='string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v);
function keys(v:Record<string,unknown>, allowed:string[]) { ensure(Object.keys(v).every(k=>allowed.includes(k))); }
export function validateCommand(value:unknown):DomainCommand {
  const command=object(value);keys(command,['action','input']);const v=object(command.input);
  switch(command.action) {
    case 'createPatch':keys(v,['title','mode']);ensure(text(v.title,200)&&typeof v.mode==='string'&&['TOPIC','MATERIAL'].includes(v.mode));break;
    case 'createSource':keys(v,['patchId','title','content']);ensure(id(v.patchId)&&text(v.title,200)&&text(v.content,200000));break;
    case 'attachSource':keys(v,['patchId','sourceId']);ensure(id(v.patchId)&&id(v.sourceId));break;
    case 'createObjective':keys(v,['patchId','description','objectiveType','difficulty']);ensure(id(v.patchId)&&text(v.description,4000)&&text(v.objectiveType,60)&&integer(v.difficulty,1,5));break;
    case 'createActivity': {
      keys(v,['objectiveId','type','prompt','answer','explanation','estimatedSeconds','metadata']);
      ensure(id(v.objectiveId)&&ACTIVITY_TYPES.includes(v.type as typeof ACTIVITY_TYPES[number])&&text(v.prompt,12000)&&text(v.answer,12000,v.type==='LEARN')&&text(v.explanation,12000,true)&&integer(v.estimatedSeconds,5,900));
      const metadata=object(v.metadata);keys(metadata,['choices']);
      if(v.type==='CHOICE') ensure(Array.isArray(metadata.choices)&&metadata.choices.length>=2&&metadata.choices.length<=6&&metadata.choices.every(c=>text(c,2000))&&new Set(metadata.choices).size===metadata.choices.length&&metadata.choices.includes(v.answer));
      else ensure(metadata.choices===undefined);
      break;
    }
    case 'createLesson':keys(v,['patchId','targetMinutes','activityIds']);ensure(id(v.patchId)&&integer(v.targetMinutes,5,15)&&Array.isArray(v.activityIds)&&v.activityIds.length>0&&v.activityIds.length<=100&&v.activityIds.every(id)&&new Set(v.activityIds).size===v.activityIds.length);break;
    case 'startLesson':case 'completeLesson':case 'abandonLesson':keys(v,['lessonId']);ensure(id(v.lessonId));break;
    case 'recordAttempt':keys(v,['activityId','lessonId','result','response','durationMs','operationId']);ensure(id(v.activityId)&&(v.lessonId==null||id(v.lessonId))&&typeof v.result==='string'&&['COMPLETED','CORRECT','INCORRECT'].includes(v.result)&&text(v.response,12000,true)&&integer(v.durationMs,0,3600000)&&id(v.operationId));break;
    case 'undoAttempt':keys(v,['attemptId']);ensure(id(v.attemptId));break;
    case 'writeObjectiveState':keys(v,['objectiveId','mastery','incorrectCount','lastReviewedAt','nextReviewAt','expectedVersion']);ensure(id(v.objectiveId)&&typeof v.mastery==='number'&&Number.isFinite(v.mastery)&&v.mastery>=0&&v.mastery<=1&&integer(v.incorrectCount,0,2147483647)&&integer(v.expectedVersion,0,2147483646)&&date(v.lastReviewedAt)&&date(v.nextReviewAt));break;
    case 'importLegacySet':keys(v,['setId']);ensure(id(v.setId));break;
    default:throw new DomainError('UNKNOWN_DOMAIN_ACTION');
  }
  return command as DomainCommand;
}
export function validateQuery(value:unknown):DomainQuery {
  const v=object(value);keys(v,['resource','id']);
  ensure(typeof v.resource==='string'&&['patches','patch','sources','objectives','lessons','activities','lesson','lessonActivities','attempts','objectiveState'].includes(v.resource));
  ensure(v.resource==='patches'?v.id===undefined:id(v.id));return v as DomainQuery;
}

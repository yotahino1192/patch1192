/** Stable client-safe contract. Import no database or provider code here. */
export const ACTIVITY_TYPES = ['LEARN', 'RECALL', 'CHOICE', 'EXPLAIN', 'APPLY'] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];
export type ContentStatus = 'ACTIVE' | 'ARCHIVED';
export type Patch = { id:string; ownerId:string; title:string; mode:'TOPIC'|'MATERIAL'; status:ContentStatus; legacySetId:string|null; createdAt:string; updatedAt:string };
export type Source = { id:string; patchId:string|null; title:string; content:string; createdAt:string; updatedAt:string };
export type LearningObjective = { id:string; patchId:string; description:string; objectiveType:string; difficulty:number; status:ContentStatus; createdAt:string; updatedAt:string };
export type Activity = { id:string; objectiveId:string; type:ActivityType; prompt:string; answer:string; explanation:string; estimatedSeconds:number; metadata:{choices?:string[]}; legacyCardId:string|null; createdAt:string; updatedAt:string };
export type AttemptResult = 'COMPLETED'|'CORRECT'|'INCORRECT';
export type Attempt = { id:string; userId:string; activityId:string; lessonId:string|null; result:AttemptResult; response:string; durationMs:number; createdAt:string; operationId:string; payloadHash:string; undoneAt:string|null };
export type ObjectiveState = { objectiveId:string; userId:string; mastery:number; incorrectCount:number; lastReviewedAt:string|null; nextReviewAt:string|null; updatedAt:string; version:number };
export const LESSON_STATUSES = ['CREATED','ACTIVE','COMPLETED','ABANDONED'] as const;
export type Lesson = { id:string; patchId:string|null; targetMinutes:number|null; status:typeof LESSON_STATUSES[number]; startedAt:string|null; completedAt:string|null; createdAt:string; estimatedSeconds:number; legacyCardIds:string[]; legacySetId:string; legacy:boolean };
export type LessonActivity = { lessonId:string; activityId:string; order:number; estimatedSeconds:number };
export type NewPatch = Pick<Patch,'title'|'mode'>;
export type NewObjective = Pick<LearningObjective,'patchId'|'description'|'objectiveType'|'difficulty'>;
export type NewActivity = Pick<Activity,'objectiveId'|'type'|'prompt'|'answer'|'explanation'|'estimatedSeconds'|'metadata'>;
export type NewLesson = { patchId:string; targetMinutes:number; activityIds:string[] };
export type RecordAttempt = Pick<Attempt,'activityId'|'result'|'response'|'durationMs'|'operationId'> & {lessonId?:string|null};
export type WriteObjectiveState = Omit<ObjectiveState,'userId'|'updatedAt'|'version'> & {expectedVersion:number};
export type DomainCommand =
 | {action:'createPatch';input:NewPatch}
 | {action:'createSource';input:{patchId:string;title:string;content:string}}
 | {action:'attachSource';input:{patchId:string;sourceId:string}}
 | {action:'createObjective';input:NewObjective}
 | {action:'createActivity';input:NewActivity}
 | {action:'createLesson';input:NewLesson}
 | {action:'startLesson'|'completeLesson'|'abandonLesson';input:{lessonId:string}}
 | {action:'recordAttempt';input:RecordAttempt}
 | {action:'undoAttempt';input:{attemptId:string}}
 | {action:'writeObjectiveState';input:WriteObjectiveState}
 | {action:'importLegacySet';input:{setId:string}};
export type CommandResults = {createPatch:Patch;createSource:Source;attachSource:Source;createObjective:LearningObjective;createActivity:Activity;createLesson:Lesson;startLesson:Lesson;completeLesson:Lesson;abandonLesson:Lesson;recordAttempt:Attempt;undoAttempt:Attempt;writeObjectiveState:ObjectiveState;importLegacySet:Patch};
export type DomainQuery = {resource:'patches'} | {resource:'patch'|'sources'|'objectives'|'lessons';id:string} | {resource:'activities';id:string} | {resource:'lesson'|'lessonActivities'|'attempts';id:string} | {resource:'objectiveState';id:string};
export type QueryResults = {patches:Patch[];patch:Patch;sources:Source[];objectives:LearningObjective[];lessons:Lesson[];activities:Activity[];lesson:Lesson;lessonActivities:LessonActivity[];attempts:Attempt[];objectiveState:ObjectiveState|null};

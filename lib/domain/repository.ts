import type { Activity, Attempt, LearningObjective, LessonActivity, ObjectiveState, Patch, Source } from './types.ts';
/** Ports are owner-bound by the unit of work; callers cannot supply another owner. */
export interface Repository<T> {
  find(where: Partial<T>): Promise<T | null>;
  list(where?: Partial<T>): Promise<T[]>;
  insert(value: T): Promise<void>;
  update(where: Partial<T>, changes: Partial<T>): Promise<number>;
}
export type SessionRecord = {id:string;patchId:string|null;targetMinutes:number|null;status:string|null;startedAt:string|null;completedAt:string|null;createdAt:string;estimatedSeconds:number;cardIds:string;setId:string;qualifies:number;onboarding:number;earnedDay:number|null};
export type LegacySet = {id:string;title:string;sourceId:string|null};
export type LegacyCard = {id:string;setId:string;question:string;answer:string;format:string;choices:string;difficulty:number;status:string};
export type LegacyReview = {id:string;cardId:string;rating:string;reviewedAt:string;durationMs:number;operationId:string|null;undoneAt:string|null};
export interface DomainRepositories {
  patches: Repository<Patch>;
  sources: Repository<Source>;
  objectives: Repository<LearningObjective>;
  activities: Repository<Activity>;
  lessons: Repository<SessionRecord>;
  lessonActivities: Repository<LessonActivity>;
  attempts: Repository<Attempt>;
  objectiveStates: Repository<ObjectiveState>;
  legacySets: Pick<Repository<LegacySet>, 'find'>;
  legacyCards: Pick<Repository<LegacyCard>, 'find'|'list'>;
  legacyReviews: Pick<Repository<LegacyReview>, 'list'>;
}
export interface DomainUnitOfWork {
  run<T>(ownerId:string, action:(repositories:DomainRepositories)=>Promise<T>):Promise<T>;
}

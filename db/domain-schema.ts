import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index, foreignKey, check } from 'drizzle-orm/sqlite-core';
import { users } from './schema';
import { studySessions } from './retention-schema';
const identity = () => ({ userId:text('user_id').notNull().references(()=>users.id), id:text('id').notNull() });
const times = () => ({createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()});
export const patches=sqliteTable('patches',{
 ...identity(),title:text('title').notNull(),mode:text('mode').notNull(),status:text('status').notNull(),legacySetId:text('legacy_set_id'),...times(),
},t=>[primaryKey({columns:[t.userId,t.id]}),uniqueIndex('patch_legacy_idx').on(t.userId,t.legacySetId),check('patch_mode',sql`${t.mode} IN ('TOPIC','MATERIAL')`),check('patch_status',sql`${t.status} IN ('ACTIVE','ARCHIVED')`)]);
export const learningObjectives=sqliteTable('learning_objectives',{
 ...identity(),patchId:text('patch_id').notNull(),description:text('description').notNull(),objectiveType:text('objective_type').notNull(),difficulty:integer('difficulty').notNull(),status:text('status').notNull(),...times(),
},t=>[primaryKey({columns:[t.userId,t.id]}),foreignKey({columns:[t.userId,t.patchId],foreignColumns:[patches.userId,patches.id]}),index('objective_patch_idx').on(t.userId,t.patchId),check('objective_difficulty',sql`${t.difficulty} BETWEEN 1 AND 5`),check('objective_status',sql`${t.status} IN ('ACTIVE','ARCHIVED')`)]);
export const activities=sqliteTable('activities',{
 ...identity(),objectiveId:text('objective_id').notNull(),type:text('type',{enum:['LEARN','RECALL','CHOICE','EXPLAIN','APPLY']}).notNull(),prompt:text('prompt').notNull(),answer:text('answer').notNull(),explanation:text('explanation').notNull(),estimatedSeconds:integer('estimated_seconds').notNull(),metadata:text('metadata').notNull(),legacyCardId:text('legacy_card_id'),...times(),
},t=>[primaryKey({columns:[t.userId,t.id]}),foreignKey({columns:[t.userId,t.objectiveId],foreignColumns:[learningObjectives.userId,learningObjectives.id]}),uniqueIndex('activity_legacy_idx').on(t.userId,t.legacyCardId),index('activity_objective_idx').on(t.userId,t.objectiveId),check('activity_type',sql`${t.type} IN ('LEARN','RECALL','CHOICE','EXPLAIN','APPLY')`),check('activity_seconds',sql`${t.estimatedSeconds} BETWEEN 5 AND 900`),check('activity_metadata',sql`json_valid(${t.metadata})`)]);
export const attempts=sqliteTable('attempts',{
 ...identity(),activityId:text('activity_id').notNull(),lessonId:text('lesson_id'),result:text('result').notNull(),response:text('response').notNull(),durationMs:integer('duration_ms').notNull(),createdAt:text('created_at').notNull(),operationId:text('operation_id').notNull(),payloadHash:text('payload_hash').notNull(),undoneAt:text('undone_at'),
},t=>[primaryKey({columns:[t.userId,t.id]}),foreignKey({columns:[t.userId,t.activityId],foreignColumns:[activities.userId,activities.id]}),foreignKey({columns:[t.userId,t.lessonId],foreignColumns:[studySessions.userId,studySessions.id]}),uniqueIndex('attempt_operation_idx').on(t.userId,t.operationId),index('attempt_lesson_idx').on(t.userId,t.lessonId),check('attempt_result',sql`${t.result} IN ('COMPLETED','CORRECT','INCORRECT')`),check('attempt_duration',sql`${t.durationMs} BETWEEN 0 AND 3600000`)]);
export const objectiveStates=sqliteTable('objective_states',{
 userId:text('user_id').notNull(),objectiveId:text('objective_id').notNull(),mastery:real('mastery').notNull(),incorrectCount:integer('incorrect_count').notNull(),lastReviewedAt:text('last_reviewed_at'),nextReviewAt:text('next_review_at'),updatedAt:text('updated_at').notNull(),version:integer('version').notNull(),
},t=>[primaryKey({columns:[t.userId,t.objectiveId]}),foreignKey({columns:[t.userId,t.objectiveId],foreignColumns:[learningObjectives.userId,learningObjectives.id]}),check('objective_mastery',sql`${t.mastery} BETWEEN 0 AND 1`),check('objective_counts',sql`${t.incorrectCount} >= 0 AND ${t.version} >= 1`)]);
export const lessonActivities=sqliteTable('lesson_activities',{
 userId:text('user_id').notNull(),lessonId:text('lesson_id').notNull(),activityId:text('activity_id').notNull(),order:integer('position').notNull(),estimatedSeconds:integer('estimated_seconds').notNull(),
},t=>[primaryKey({columns:[t.userId,t.lessonId,t.order]}),uniqueIndex('lesson_activity_once_idx').on(t.userId,t.lessonId,t.activityId),foreignKey({columns:[t.userId,t.lessonId],foreignColumns:[studySessions.userId,studySessions.id]}),foreignKey({columns:[t.userId,t.activityId],foreignColumns:[activities.userId,activities.id]}),check('lesson_position',sql`${t.order} >= 0`),check('lesson_activity_seconds',sql`${t.estimatedSeconds} BETWEEN 5 AND 900`)]);

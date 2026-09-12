import { sql } from 'drizzle-orm';
import { check, sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { users } from './schema';
export const aiRequests = sqliteTable('ai_requests', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id),
  keyHash: text('key_hash').notNull(), payloadHash: text('payload_hash').notNull(),
  endpoint: text('endpoint', { enum: ['cards', 'chat'] }).notNull(),
  state: text('state', { enum: ['reserved', 'dispatching', 'succeeded', 'failed_pre_dispatch', 'failed_final', 'unknown', 'expired'] }).notNull(),
  generation: integer('generation').notNull().default(0), consentRevision: integer('consent_revision').notNull().default(0),
  createdAt: integer('created_at').notNull(), leaseUntil: integer('lease_until').notNull(), resultUntil: integer('result_until').notNull(),
  costMicros: integer('cost_micros').notNull(), inputTokens: integer('input_tokens'), outputTokens: integer('output_tokens'), resultJson: text('result_json'),
}, t => [check('ai_state', sql`${t.state} IN ('reserved','dispatching','succeeded','failed_pre_dispatch','failed_final','unknown','expired')`), check('ai_endpoint', sql`${t.endpoint} IN ('cards','chat')`), check('ai_cost_nonnegative', sql`${t.costMicros} >= 0`), uniqueIndex('ai_requests_user_key').on(t.userId, t.keyHash), index('ai_requests_created').on(t.createdAt), index('ai_requests_user_created').on(t.userId, t.createdAt), index('ai_requests_state').on(t.state)]);
export const aiControl = sqliteTable('ai_control', { id: integer('id').primaryKey(), enabled: integer('enabled').notNull() }, t => [check('ai_single_control', sql`${t.id}=1`), check('ai_enabled_boolean', sql`${t.enabled} IN (0,1)`)]);

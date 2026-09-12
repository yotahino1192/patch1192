import { primaryKey, index, uniqueIndex, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  lifecycleState: text("lifecycle_state").notNull().default("active"),
  generation: integer("generation").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const authIdentities = sqliteTable("auth_identities", {
  issuer: text("issuer").notNull(),
  subject: text("subject").notNull(),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
}, table => [primaryKey({ columns: [table.issuer, table.subject] }), index("auth_identities_user_idx").on(table.userId)]);

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("sources_user_idx").on(table.userId)]);

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("folders_user_parent_idx").on(table.userId, table.parentId)]);

export const cardSets = sqliteTable("card_sets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceId: text("source_id").notNull(),
  folderId: text("folder_id"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  summary: text("summary").notNull(),
  keyPoints: text("key_points").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastStudiedAt: text("last_studied_at"),
  nextReviewAt: text("next_review_at"),
}, (table) => [index("card_sets_user_idx").on(table.userId)]);

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  format: text("format").notNull().default("qa"),
  choices: text("choices").notNull().default("[]"),
  status: text("status").notNull(),
  difficulty: integer("difficulty").notNull(),
  dueAt: text("due_at").notNull(),
  intervalDays: integer("interval_days").notNull(),
  reviewCount: integer("review_count").notNull(),
  correctCount: integer("correct_count").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("cards_user_idx").on(table.userId),
  index("cards_set_idx").on(table.setId),
  index("cards_due_idx").on(table.dueAt),
]);

export const reviewLogs = sqliteTable("review_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  cardId: text("card_id").notNull(),
  sessionId: text("session_id"),
  rating: text("rating").notNull(),
  responseMs: integer("response_ms").notNull(),
  reviewedAt: text("reviewed_at").notNull(),
  previousState: text("previous_state"),
  undoneAt: text("undone_at"),
  operationId: text("operation_id"),
}, (table) => [
  index("review_logs_user_idx").on(table.userId),
  index("review_logs_card_idx").on(table.cardId),
  index("review_logs_session_idx").on(table.sessionId),
  uniqueIndex("review_logs_user_operation_idx").on(table.userId, table.operationId),
  index("review_logs_user_session_idx").on(table.userId, table.sessionId),
]);

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  setId: text("set_id"),
  cardId: text("card_id"),
  sessionId: text("session_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("chat_messages_user_idx").on(table.userId),
  index("chat_messages_card_idx").on(table.cardId),
  index("chat_messages_session_idx").on(table.sessionId),
]);

export const dailyReviewPlans = sqliteTable("daily_review_plans", {
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  cardIds: text("card_ids").notNull(),
  completedAt: text("completed_at"),
}, (table) => [primaryKey({ columns: [table.userId, table.day] })]);

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  interests: text("interests").notNull().default("[]"),
  learningGoal: text("learning_goal").notNull().default(""),
  onboardingCompleted: integer("onboarding_completed").notNull().default(0),
  onboardingCompletedAt: text("onboarding_completed_at"),
  initialSetId: text("initial_set_id"),
  initialCardIds: text("initial_card_ids").notNull().default("[]"),
  initialSessionId: text("initial_session_id"),
  firstLearningCompletedAt: text("first_learning_completed_at"),
});

export const userConsents = sqliteTable("user_consents", {
 userId:text("user_id").notNull(),scope:text("scope").notNull(),state:text("state").notNull(),consentVersion:text("consent_version").notNull(),policyVersion:text("policy_version").notNull(),revision:integer("revision").notNull(),operationId:text("operation_id").notNull(),textHash:text("text_hash").notNull(),language:text("language").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.scope]})]);
export const consentEvents = sqliteTable("consent_events", {
 userId:text("user_id").notNull(),operationId:text("operation_id").notNull(),payloadHash:text("payload_hash").notNull(),state:text("state").notNull(),consentVersion:text("consent_version").notNull(),policyVersion:text("policy_version").notNull(),revision:integer("revision").notNull(),textHash:text("text_hash").notNull(),language:text("language").notNull(),createdAt:text("created_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.operationId]})]);
export const aiOperations = sqliteTable("ai_operations", {
 userId:text("user_id").notNull(),operationId:text("operation_id").notNull(),kind:text("kind").notNull(),payloadHash:text("payload_hash").notNull(),generation:integer("generation").notNull(),consentRevision:integer("consent_revision").notNull(),state:text("state").notNull(),createdAt:text("created_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.operationId]})]);
export const deletionChallenges=sqliteTable("deletion_challenges",{id:text("id").primaryKey(),userId:text("user_id").notNull(),sessionId:text("session_id").notNull(),previousVerificationId:text("previous_verification_id").notNull(),expiresAt:integer("expires_at").notNull(),used:integer("used").notNull().default(0)});
export const accountDeletionJobs=sqliteTable("account_deletion_jobs",{
 id:text("id").primaryKey(),userId:text("user_id").notNull().unique(),issuer:text("issuer").notNull(),subject:text("subject").notNull(),operationId:text("operation_id").notNull(),receiptHash:text("receipt_hash").notNull(),state:text("state").notNull().default("pending"),dbStep:text("db_step").notNull().default("pending"),clerkStep:text("clerk_step").notNull().default("pending"),appleStep:text("apple_step").notNull().default("not_applicable"),attempts:integer("attempts").notNull().default(0),nextAttemptAt:integer("next_attempt_at").notNull().default(0),leaseToken:text("lease_token"),leaseUntil:integer("lease_until").notNull().default(0),lastError:text("last_error"),createdAt:text("created_at").notNull(),completedAt:text("completed_at"),
},t=>[index("deletion_jobs_due_idx").on(t.state,t.nextAttemptAt,t.leaseUntil)]);
export const deletedIdentityTombstones=sqliteTable("deleted_identity_tombstones",{identityHash:text("identity_hash").primaryKey(),userId:text("user_id").notNull(),createdAt:text("created_at").notNull()});

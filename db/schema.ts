import { primaryKey, index, uniqueIndex, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

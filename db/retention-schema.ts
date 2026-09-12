import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
export const retentionState=sqliteTable("retention_state",{
 userId:text("user_id").primaryKey(),day:integer("day").notNull(),dayEnd:integer("day_end").notNull(),timezone:text("timezone").notNull(),pendingTimezone:text("pending_timezone").notNull(),
 reminderTime:text("reminder_time").notNull().default("19:00"),reviewReminder:integer("review_reminder").notNull().default(0),streakWarning:integer("streak_warning").notNull().default(0),
});
export const studySessions=sqliteTable("study_sessions",{
 userId:text("user_id").notNull(),id:text("id").notNull(),setId:text("set_id").notNull(),cardIds:text("card_ids").notNull(),estimatedSeconds:integer("estimated_seconds").notNull(),qualifies:integer("qualifies").notNull(),onboarding:integer("onboarding").notNull().default(0),createdAt:text("created_at").notNull(),completedAt:text("completed_at"),earnedDay:integer("earned_day"),
},t=>[primaryKey({columns:[t.userId,t.id]}),index("study_sessions_user_day_idx").on(t.userId,t.earnedDay)]);

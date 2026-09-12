CREATE TABLE `retention_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`day` integer NOT NULL,
	`day_end` integer NOT NULL,
	`timezone` text NOT NULL,
	`pending_timezone` text NOT NULL,
	`reminder_time` text DEFAULT '19:00' NOT NULL,
	`review_reminder` integer DEFAULT 0 NOT NULL,
	`streak_warning` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`set_id` text NOT NULL,
	`card_ids` text NOT NULL,
	`estimated_seconds` integer NOT NULL,
	`qualifies` integer NOT NULL,
	`onboarding` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	`earned_day` integer,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `study_sessions_user_day_idx` ON `study_sessions` (`user_id`,`earned_day`);
--> statement-breakpoint
CREATE TRIGGER retention_state_active_insert BEFORE INSERT ON retention_state
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER retention_state_active_update BEFORE UPDATE ON retention_state
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER study_sessions_active_insert BEFORE INSERT ON study_sessions
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER study_sessions_active_update BEFORE UPDATE ON study_sessions
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

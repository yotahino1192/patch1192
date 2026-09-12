CREATE TABLE `account_deletion_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`operation_id` text NOT NULL,
	`receipt_hash` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`db_step` text DEFAULT 'pending' NOT NULL,
	`clerk_step` text DEFAULT 'pending' NOT NULL,
	`apple_step` text DEFAULT 'not_applicable' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_deletion_jobs_user_id_unique` ON `account_deletion_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `deletion_jobs_due_idx` ON `account_deletion_jobs` (`state`,`next_attempt_at`,`lease_until`);--> statement-breakpoint
CREATE TABLE `ai_operations` (
	`user_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_hash` text NOT NULL,
	`generation` integer NOT NULL,
	`consent_revision` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `operation_id`)
);
--> statement-breakpoint
CREATE TABLE `consent_events` (
	`user_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`state` text NOT NULL,
	`consent_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`revision` integer NOT NULL,
	`text_hash` text NOT NULL,
	`language` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `operation_id`)
);
--> statement-breakpoint
CREATE TABLE `deleted_identity_tombstones` (
	`identity_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deletion_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`previous_verification_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_consents` (
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`state` text NOT NULL,
	`consent_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`revision` integer NOT NULL,
	`operation_id` text NOT NULL,
	`text_hash` text NOT NULL,
	`language` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `scope`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `lifecycle_state` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `generation` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sources_active_insert BEFORE INSERT ON sources
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sources_active_update BEFORE UPDATE ON sources
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS folders_active_insert BEFORE INSERT ON folders
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS folders_active_update BEFORE UPDATE ON folders
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS card_sets_active_insert BEFORE INSERT ON card_sets
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS card_sets_active_update BEFORE UPDATE ON card_sets
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS cards_active_insert BEFORE INSERT ON cards
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS cards_active_update BEFORE UPDATE ON cards
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS review_logs_active_insert BEFORE INSERT ON review_logs
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS review_logs_active_update BEFORE UPDATE ON review_logs
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS chat_messages_active_insert BEFORE INSERT ON chat_messages
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS chat_messages_active_update BEFORE UPDATE ON chat_messages
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS daily_review_plans_active_insert BEFORE INSERT ON daily_review_plans
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS daily_review_plans_active_update BEFORE UPDATE ON daily_review_plans
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS user_profiles_active_insert BEFORE INSERT ON user_profiles
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS user_profiles_active_update BEFORE UPDATE ON user_profiles
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS user_consents_active_insert BEFORE INSERT ON user_consents
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS user_consents_active_update BEFORE UPDATE ON user_consents
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS consent_events_active_insert BEFORE INSERT ON consent_events
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS consent_events_active_update BEFORE UPDATE ON consent_events
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS ai_operations_active_insert BEFORE INSERT ON ai_operations
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS ai_operations_active_update BEFORE UPDATE ON ai_operations
WHEN EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state <> 'active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

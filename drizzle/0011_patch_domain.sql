CREATE TABLE `activities` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`objective_id` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`answer` text NOT NULL,
	`explanation` text NOT NULL,
	`estimated_seconds` integer NOT NULL,
	`metadata` text NOT NULL,
	`legacy_card_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`objective_id`) REFERENCES `learning_objectives`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "activity_type" CHECK("activities"."type" IN ('LEARN','RECALL','CHOICE','EXPLAIN','APPLY')),
	CONSTRAINT "activity_seconds" CHECK("activities"."estimated_seconds" BETWEEN 5 AND 900),
	CONSTRAINT "activity_metadata" CHECK(json_valid("activities"."metadata"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_legacy_idx` ON `activities` (`user_id`,`legacy_card_id`);--> statement-breakpoint
CREATE INDEX `activity_objective_idx` ON `activities` (`user_id`,`objective_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`activity_id` text NOT NULL,
	`lesson_id` text,
	`result` text NOT NULL,
	`response` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`created_at` text NOT NULL,
	`operation_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`undone_at` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`activity_id`) REFERENCES `activities`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`lesson_id`) REFERENCES `study_sessions`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attempt_result" CHECK("attempts"."result" IN ('COMPLETED','CORRECT','INCORRECT')),
	CONSTRAINT "attempt_duration" CHECK("attempts"."duration_ms" BETWEEN 0 AND 3600000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_operation_idx` ON `attempts` (`user_id`,`operation_id`);--> statement-breakpoint
CREATE INDEX `attempt_lesson_idx` ON `attempts` (`user_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `learning_objectives` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`patch_id` text NOT NULL,
	`description` text NOT NULL,
	`objective_type` text NOT NULL,
	`difficulty` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`patch_id`) REFERENCES `patches`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "objective_difficulty" CHECK("learning_objectives"."difficulty" BETWEEN 1 AND 5),
	CONSTRAINT "objective_status" CHECK("learning_objectives"."status" IN ('ACTIVE','ARCHIVED'))
);
--> statement-breakpoint
CREATE INDEX `objective_patch_idx` ON `learning_objectives` (`user_id`,`patch_id`);--> statement-breakpoint
CREATE TABLE `lesson_activities` (
	`user_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`position` integer NOT NULL,
	`estimated_seconds` integer NOT NULL,
	PRIMARY KEY(`user_id`, `lesson_id`, `position`),
	FOREIGN KEY (`user_id`,`lesson_id`) REFERENCES `study_sessions`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`activity_id`) REFERENCES `activities`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lesson_position" CHECK("lesson_activities"."position" >= 0),
	CONSTRAINT "lesson_activity_seconds" CHECK("lesson_activities"."estimated_seconds" BETWEEN 5 AND 900)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_activity_once_idx` ON `lesson_activities` (`user_id`,`lesson_id`,`activity_id`);--> statement-breakpoint
CREATE TABLE `objective_states` (
	`user_id` text NOT NULL,
	`objective_id` text NOT NULL,
	`mastery` real NOT NULL,
	`incorrect_count` integer NOT NULL,
	`last_reviewed_at` text,
	`next_review_at` text,
	`updated_at` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`user_id`, `objective_id`),
	FOREIGN KEY (`user_id`,`objective_id`) REFERENCES `learning_objectives`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "objective_mastery" CHECK("objective_states"."mastery" BETWEEN 0 AND 1),
	CONSTRAINT "objective_counts" CHECK("objective_states"."incorrect_count" >= 0 AND "objective_states"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE `patches` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`legacy_set_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "patch_mode" CHECK("patches"."mode" IN ('TOPIC','MATERIAL')),
	CONSTRAINT "patch_status" CHECK("patches"."status" IN ('ACTIVE','ARCHIVED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patch_legacy_idx` ON `patches` (`user_id`,`legacy_set_id`);--> statement-breakpoint
ALTER TABLE `sources` ADD `patch_id` text;--> statement-breakpoint
ALTER TABLE `study_sessions` ADD `patch_id` text;--> statement-breakpoint
ALTER TABLE `study_sessions` ADD `target_minutes` integer;--> statement-breakpoint
ALTER TABLE `study_sessions` ADD `status` text;--> statement-breakpoint
ALTER TABLE `study_sessions` ADD `started_at` text;
--> statement-breakpoint
CREATE TRIGGER patches_domain_active_insert BEFORE INSERT ON patches
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER patches_domain_active_update BEFORE UPDATE ON patches
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER learning_objectives_domain_active_insert BEFORE INSERT ON learning_objectives
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER learning_objectives_domain_active_update BEFORE UPDATE ON learning_objectives
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER activities_domain_active_insert BEFORE INSERT ON activities
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER activities_domain_active_update BEFORE UPDATE ON activities
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER attempts_domain_active_insert BEFORE INSERT ON attempts
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER attempts_domain_active_update BEFORE UPDATE ON attempts
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER objective_states_domain_active_insert BEFORE INSERT ON objective_states
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER objective_states_domain_active_update BEFORE UPDATE ON objective_states
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER lesson_activities_domain_active_insert BEFORE INSERT ON lesson_activities
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER lesson_activities_domain_active_update BEFORE UPDATE ON lesson_activities
WHEN NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND lifecycle_state='active')
BEGIN SELECT RAISE(ABORT, 'ACCOUNT_INACTIVE'); END;

--> statement-breakpoint
CREATE TRIGGER sources_patch_insert BEFORE INSERT ON sources
WHEN NEW.patch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM patches p WHERE p.id=NEW.patch_id AND p.user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'PATCH_OWNER_MISMATCH'); END;

--> statement-breakpoint
CREATE TRIGGER patch_legacy_insert BEFORE INSERT ON patches
WHEN NEW.legacy_set_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM card_sets s WHERE s.id=NEW.legacy_set_id AND s.user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'LEGACY_OWNER_MISMATCH'); END;

--> statement-breakpoint
CREATE TRIGGER activity_legacy_insert BEFORE INSERT ON activities
WHEN NEW.legacy_card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.id=NEW.legacy_card_id AND c.user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'LEGACY_OWNER_MISMATCH'); END;

--> statement-breakpoint
CREATE TRIGGER lesson_domain_insert BEFORE INSERT ON study_sessions
WHEN NEW.patch_id IS NOT NULL AND (NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM patches p JOIN users u ON u.id=p.user_id WHERE p.id=NEW.patch_id AND p.user_id=NEW.user_id AND u.lifecycle_state='active') OR NEW.target_minutes IS NULL OR typeof(NEW.target_minutes)<>'integer' OR NEW.target_minutes NOT BETWEEN 5 AND 15 OR NEW.status IS NULL OR NEW.status NOT IN ('CREATED','ACTIVE','COMPLETED','ABANDONED') OR NEW.estimated_seconds NOT BETWEEN 300 AND 900 OR NEW.card_ids<>'[]' OR NEW.qualifies<>0 OR NEW.onboarding<>0 OR NEW.earned_day IS NOT NULL OR (NEW.status='COMPLETED')<>(NEW.completed_at IS NOT NULL) OR (NEW.status IN ('ACTIVE','COMPLETED') AND NEW.started_at IS NULL))
BEGIN SELECT RAISE(ABORT, 'INVALID_DOMAIN_LESSON'); END;

--> statement-breakpoint
CREATE TRIGGER lesson_activity_patch_insert BEFORE INSERT ON lesson_activities
WHEN NOT EXISTS (SELECT 1 FROM study_sessions s JOIN activities a ON a.id=NEW.activity_id AND a.user_id=s.user_id JOIN learning_objectives o ON o.id=a.objective_id AND o.user_id=a.user_id WHERE s.id=NEW.lesson_id AND s.user_id=NEW.user_id AND s.patch_id=o.patch_id AND s.status='CREATED')
BEGIN SELECT RAISE(ABORT, 'LESSON_ASSIGNMENT_INVALID'); END;

--> statement-breakpoint
CREATE TRIGGER attempt_membership_insert BEFORE INSERT ON attempts
WHEN NEW.lesson_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lesson_activities a WHERE a.user_id=NEW.user_id AND a.lesson_id=NEW.lesson_id AND a.activity_id=NEW.activity_id)
BEGIN SELECT RAISE(ABORT, 'ATTEMPT_MEMBERSHIP_INVALID'); END;

--> statement-breakpoint
CREATE TRIGGER sources_patch_update BEFORE UPDATE ON sources
WHEN NEW.patch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM patches p WHERE p.id=NEW.patch_id AND p.user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'PATCH_OWNER_MISMATCH'); END;

--> statement-breakpoint
CREATE TRIGGER patch_legacy_update BEFORE UPDATE ON patches
WHEN NEW.legacy_set_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM card_sets s WHERE s.id=NEW.legacy_set_id AND s.user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'LEGACY_OWNER_MISMATCH'); END;

--> statement-breakpoint
CREATE TRIGGER activity_legacy_update BEFORE UPDATE ON activities
WHEN NEW.legacy_card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.id=NEW.legacy_card_id AND c.user_id=NEW.user_id)
BEGIN SELECT RAISE(ABORT, 'LEGACY_OWNER_MISMATCH'); END;

--> statement-breakpoint
CREATE TRIGGER lesson_domain_update BEFORE UPDATE ON study_sessions
WHEN NEW.patch_id IS NOT NULL AND (NEW.user_id='loop-owner' OR NOT EXISTS (SELECT 1 FROM patches p JOIN users u ON u.id=p.user_id WHERE p.id=NEW.patch_id AND p.user_id=NEW.user_id AND u.lifecycle_state='active') OR NEW.target_minutes IS NULL OR typeof(NEW.target_minutes)<>'integer' OR NEW.target_minutes NOT BETWEEN 5 AND 15 OR NEW.status IS NULL OR NEW.status NOT IN ('CREATED','ACTIVE','COMPLETED','ABANDONED') OR NEW.estimated_seconds NOT BETWEEN 300 AND 900 OR NEW.card_ids<>'[]' OR NEW.qualifies<>0 OR NEW.onboarding<>0 OR NEW.earned_day IS NOT NULL OR (NEW.status='COMPLETED')<>(NEW.completed_at IS NOT NULL) OR (NEW.status IN ('ACTIVE','COMPLETED') AND NEW.started_at IS NULL))
BEGIN SELECT RAISE(ABORT, 'INVALID_DOMAIN_LESSON'); END;

--> statement-breakpoint
CREATE TRIGGER lesson_activity_patch_update BEFORE UPDATE ON lesson_activities
WHEN NOT EXISTS (SELECT 1 FROM study_sessions s JOIN activities a ON a.id=NEW.activity_id AND a.user_id=s.user_id JOIN learning_objectives o ON o.id=a.objective_id AND o.user_id=a.user_id WHERE s.id=NEW.lesson_id AND s.user_id=NEW.user_id AND s.patch_id=o.patch_id AND s.status='CREATED')
BEGIN SELECT RAISE(ABORT, 'LESSON_ASSIGNMENT_INVALID'); END;

--> statement-breakpoint
CREATE TRIGGER attempt_membership_update BEFORE UPDATE ON attempts
WHEN NEW.lesson_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lesson_activities a WHERE a.user_id=NEW.user_id AND a.lesson_id=NEW.lesson_id AND a.activity_id=NEW.activity_id)
BEGIN SELECT RAISE(ABORT, 'ATTEMPT_MEMBERSHIP_INVALID'); END;

--> statement-breakpoint
CREATE TRIGGER session_domain_identity_immutable BEFORE UPDATE ON study_sessions
WHEN OLD.patch_id IS NOT NEW.patch_id
BEGIN SELECT RAISE(ABORT, 'LESSON_IDENTITY_IMMUTABLE'); END;

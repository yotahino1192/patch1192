CREATE TABLE `card_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`summary` text NOT NULL,
	`key_points` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_studied_at` text,
	`next_review_at` text
);
--> statement-breakpoint
CREATE INDEX `card_sets_user_idx` ON `card_sets` (`user_id`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`set_id` text NOT NULL,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`status` text NOT NULL,
	`difficulty` integer NOT NULL,
	`due_at` text NOT NULL,
	`interval_days` integer NOT NULL,
	`review_count` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cards_user_idx` ON `cards` (`user_id`);--> statement-breakpoint
CREATE INDEX `cards_set_idx` ON `cards` (`set_id`);--> statement-breakpoint
CREATE INDEX `cards_due_idx` ON `cards` (`due_at`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`set_id` text,
	`card_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_messages_user_idx` ON `chat_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `chat_messages_card_idx` ON `chat_messages` (`card_id`);--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`rating` text NOT NULL,
	`response_ms` integer NOT NULL,
	`reviewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_logs_user_idx` ON `review_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `review_logs_card_idx` ON `review_logs` (`card_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sources_user_idx` ON `sources` (`user_id`);
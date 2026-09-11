CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`interests` text DEFAULT '[]' NOT NULL,
	`learning_goal` text DEFAULT '' NOT NULL,
	`onboarding_completed` integer DEFAULT 0 NOT NULL,
	`onboarding_completed_at` text,
	`initial_set_id` text,
	`initial_card_ids` text DEFAULT '[]' NOT NULL,
	`initial_session_id` text,
	`first_learning_completed_at` text
);

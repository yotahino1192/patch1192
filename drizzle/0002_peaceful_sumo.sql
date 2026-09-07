CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `folders_user_parent_idx` ON `folders` (`user_id`,`parent_id`);--> statement-breakpoint
ALTER TABLE `card_sets` ADD `folder_id` text;
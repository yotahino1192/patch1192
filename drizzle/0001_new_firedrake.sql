ALTER TABLE `cards` ADD `format` text DEFAULT 'qa' NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `choices` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `session_id` text;--> statement-breakpoint
CREATE INDEX `chat_messages_session_idx` ON `chat_messages` (`session_id`);--> statement-breakpoint
ALTER TABLE `review_logs` ADD `session_id` text;--> statement-breakpoint
CREATE INDEX `review_logs_session_idx` ON `review_logs` (`session_id`);
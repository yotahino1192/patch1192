ALTER TABLE `review_logs` ADD `operation_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `review_logs_user_operation_idx` ON `review_logs` (`user_id`,`operation_id`);--> statement-breakpoint
CREATE INDEX `review_logs_user_session_idx` ON `review_logs` (`user_id`,`session_id`);
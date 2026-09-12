CREATE TABLE `ai_control` (
	`id` integer PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	CONSTRAINT "ai_single_control" CHECK("ai_control"."id"=1),
	CONSTRAINT "ai_enabled_boolean" CHECK("ai_control"."enabled" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`payload_hash` text NOT NULL,
	`endpoint` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	`lease_until` integer NOT NULL,
	`result_until` integer NOT NULL,
	`cost_micros` integer NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`result_json` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_state" CHECK("ai_requests"."state" IN ('reserved','dispatching','succeeded','failed_pre_dispatch','failed_final','unknown','expired')),
	CONSTRAINT "ai_endpoint" CHECK("ai_requests"."endpoint" IN ('cards','chat')),
	CONSTRAINT "ai_cost_nonnegative" CHECK("ai_requests"."cost_micros" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_requests_user_key` ON `ai_requests` (`user_id`,`key_hash`);--> statement-breakpoint
CREATE INDEX `ai_requests_created` ON `ai_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_requests_user_created` ON `ai_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_requests_state` ON `ai_requests` (`state`);
--> statement-breakpoint
INSERT INTO ai_control(id,enabled) VALUES(1,1);

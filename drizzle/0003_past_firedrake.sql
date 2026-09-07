CREATE TABLE `daily_review_plans` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`card_ids` text NOT NULL,
	`completed_at` text,
	PRIMARY KEY(`user_id`, `day`)
);

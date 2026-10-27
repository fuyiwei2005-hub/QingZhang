CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`result` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_requests_user_day_idx` ON `ai_requests` (`user_id`,`day`);--> statement-breakpoint
CREATE INDEX `ai_requests_day_idx` ON `ai_requests` (`day`);
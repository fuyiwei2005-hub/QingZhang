CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`monthly_budget` real DEFAULT 5000 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `notes` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `deleted_at` text;
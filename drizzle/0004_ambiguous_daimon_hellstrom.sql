CREATE TABLE `category_budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_budgets_unique` ON `category_budgets` (`user_id`,`category`);--> statement-breakpoint
CREATE TABLE `recurring_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`rule_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_events_unique` ON `recurring_events` (`rule_id`,`date`);--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`account` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`frequency` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurring_rules_user_idx` ON `recurring_rules` (`user_id`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`from_account` text NOT NULL,
	`to_account` text NOT NULL,
	`amount` real NOT NULL,
	`occurred_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transfers_user_idx` ON `transfers` (`user_id`);--> statement-breakpoint
ALTER TABLE `notes` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `todos` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `source_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_source_unique` ON `transactions` (`user_id`,`source_key`);
CREATE TABLE `studio_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `studio_clients_user_idx` ON `studio_clients` (`user_id`);--> statement-breakpoint
CREATE TABLE `studio_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`stage_id` text,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`account` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`deleted_at` text,
	`source_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stage_id`) REFERENCES `studio_stages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `studio_entries_user_date_idx` ON `studio_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_entries_source_idx` ON `studio_entries` (`user_id`,`source_key`);--> statement-breakpoint
CREATE TABLE `studio_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`contract_cents` integer NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `studio_clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `studio_projects_user_idx` ON `studio_projects` (`user_id`);--> statement-breakpoint
CREATE TABLE `studio_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `studio_stages_project_idx` ON `studio_stages` (`project_id`);--> statement-breakpoint
CREATE TABLE `studio_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`done` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `studio_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `studio_tasks_user_idx` ON `studio_tasks` (`user_id`);
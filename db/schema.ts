import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  type: text("type", { enum: ["expense", "income"] }).notNull(),
  amount: real("amount").notNull(), category: text("category").notNull(),
  account: text("account").notNull().default("微信"), note: text("note").notNull().default(""),
  occurredAt: text("occurred_at").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
  sourceKey: text("source_key"),
}, (table) => [index("transactions_user_date_idx").on(table.userId, table.occurredAt), uniqueIndex("transactions_source_unique").on(table.userId, table.sourceKey)]);

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  todos: text("todos", { mode: "json" }).$type<Array<{ id: string; text: string; done: boolean }>>().notNull().default(sql`'[]'`),
}, (table) => [index("notes_user_updated_idx").on(table.userId, table.updatedAt)]);

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey(),
  monthlyBudget: real("monthly_budget").notNull().default(5000),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const transfers = sqliteTable("transfers", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(),
  fromAccount: text("from_account").notNull(), toAccount: text("to_account").notNull(),
  amount: real("amount").notNull(), occurredAt: text("occurred_at").notNull(), note: text("note").notNull().default(""),
  deletedAt: text("deleted_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("transfers_user_idx").on(t.userId)]);

export const categoryBudgets = sqliteTable("category_budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(),
  category: text("category").notNull(), amount: real("amount").notNull(),
}, (t) => [uniqueIndex("category_budgets_unique").on(t.userId, t.category)]);

export const recurringRules = sqliteTable("recurring_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(),
  type: text("type", { enum: ["expense", "income"] }).notNull(), amount: real("amount").notNull(),
  category: text("category").notNull(), account: text("account").notNull(), note: text("note").notNull().default(""),
  frequency: text("frequency", { enum: ["weekly", "monthly", "yearly"] }).notNull(),
  startDate: text("start_date").notNull(), endDate: text("end_date"), active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (t) => [index("recurring_rules_user_idx").on(t.userId)]);

export const recurringEvents = sqliteTable("recurring_events", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: text("user_id").notNull(),
  ruleId: integer("rule_id").notNull(), date: text("date").notNull(), status: text("status", { enum: ["confirmed", "skipped"] }).notNull(),
}, (t) => [uniqueIndex("recurring_events_unique").on(t.ruleId, t.date)]);

export const wheels = sqliteTable("wheels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  options: text("options", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [index("wheels_user_idx").on(t.userId)]);

export const lifeItems = sqliteTable("life_items", {
 id: integer("id").primaryKey({ autoIncrement: true }),
 userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
 kind: text("kind").notNull(),
 data: text("data", { mode: "json" }).$type<import("../lib/life").LifeData>().notNull(),
 version: integer("version").notNull().default(1),
 createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [index("life_items_user_idx").on(t.userId)]);
export const lifeEvents = sqliteTable("life_events", {
 id: integer("id").primaryKey({ autoIncrement: true }),
 userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
 itemId: integer("item_id").notNull().references(() => lifeItems.id, { onDelete: "cascade" }),
 date: text("date").notNull(), amount: real("amount").notNull().default(0), note: text("note").notNull().default(""),
 eventKey: text("event_key").notNull(),
}, t => [uniqueIndex("life_events_key_idx").on(t.userId,t.eventKey), index("life_events_item_idx").on(t.itemId)]);

export const customCategories = sqliteTable("custom_categories", {
 id: integer("id").primaryKey({ autoIncrement: true }),
 userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
 type: text("type", {enum:["expense","income"]}).notNull(),
 name: text("name").notNull(),
}, t => [uniqueIndex("custom_categories_unique").on(t.userId,t.type,t.name)]);

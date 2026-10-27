import {sql} from "drizzle-orm";
import {sqliteTable,text,index} from "drizzle-orm/sqlite-core";
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

export const aiRequests = sqliteTable("ai_requests", {
 id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
 day:text("day").notNull(),status:text("status").notNull(),createdAt:text("created_at").notNull(),
 result:text("result",{mode:"json"}).$type<unknown>(),
},t=>[index("ai_requests_user_day_idx").on(t.userId,t.day),index("ai_requests_day_idx").on(t.day)]);



export * from "./studio-schema";

import { userCategories } from "../../../lib/user-categories";
import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { recurringRules, recurringEvents } from "../../../db/schema";
import { entryInput, occurrenceDates, todayChina, validDate } from "../../../lib/ledger-domain";
import { getAppUser } from "../../auth";
export async function GET() {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const db = getDb();
  const rules = await db.select().from(recurringRules).where(eq(recurringRules.userId, user.id));
  const events = await db.select().from(recurringEvents).where(eq(recurringEvents.userId, user.id));
  const handled = new Set(events.map((e) => `${e.ruleId}:${e.date}`));
  const pending = rules.filter((r) => r.active).flatMap((r) => occurrenceDates(r.startDate, r.frequency, todayChina(), r.endDate).filter((date) => !handled.has(`${r.id}:${date}`)).map((date) => ({ ...r, date }))).sort((a, b) => a.date.localeCompare(b.date));
  return Response.json({ rules, pending: pending.slice(0, 200), pendingCount: pending.length });
}
export async function POST(request: Request) {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "无效请求" }, { status: 400 });
  const v = body as Record<string, unknown>;
  const entry = entryInput({ ...v, date: v.startDate }, await userCategories(user.id));
  if (!entry || !["weekly", "monthly", "yearly"].includes(String(v.frequency)) || (v.endDate && (!validDate(v.endDate) || v.endDate < entry.date))) return Response.json({ error: "请核对周期规则、起止日期和金额" }, { status: 400 });
  const { date, ...fields } = entry;
  const [rule] = await getDb().insert(recurringRules).values({ ...fields, userId: user.id, startDate: date, endDate: typeof v.endDate === "string" && v.endDate ? v.endDate : null, frequency: v.frequency as "weekly" | "monthly" | "yearly" }).returning();
  return Response.json({ rule }, { status: 201 });
}
export async function PATCH(request: Request) {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id: number; action: string; date?: string; active?: boolean } | null;
  if (!body || !Number.isInteger(body.id)) return Response.json({ error: "无效规则" }, { status: 400 });
  const db = getDb();
  const [rule] = await db.select().from(recurringRules).where(and(eq(recurringRules.id, body.id), eq(recurringRules.userId, user.id)));
  if (!rule) return Response.json({ error: "规则不存在" }, { status: 404 });
  if (body.action === "toggle" && typeof body.active === "boolean") {
    await db.update(recurringRules).set({ active: body.active }).where(eq(recurringRules.id, rule.id)); return Response.json({ ok: true });
  }
  if (!["confirm", "skip"].includes(body.action) || !rule.active || !validDate(body.date) || !occurrenceDates(rule.startDate, rule.frequency, todayChina(), rule.endDate).includes(body.date)) return Response.json({ error: "该日期不属于待确认的有效周期账单" }, { status: 400 });
  const date = body.date;
  const status = body.action === "confirm" ? "confirmed" : "skipped";
  const event = db.insert(recurringEvents).values({ userId: user.id, ruleId: rule.id, date, status }).onConflictDoNothing();
  if (status === "confirmed") {
    const key = `recurring:${rule.id}:${date}`;
    await env.DB!.batch([
      env.DB!.prepare("INSERT OR IGNORE INTO recurring_events(user_id,rule_id,date,status) VALUES(?,?,?,?)").bind(user.id, rule.id, date, status),
      env.DB!.prepare("INSERT OR IGNORE INTO transactions(user_id,type,amount,category,account,note,occurred_at,source_key) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM recurring_events WHERE rule_id=? AND date=? AND status='confirmed')").bind(user.id, rule.type, rule.amount, rule.category, rule.account, rule.note, `${date}T12:00:00Z`, key, rule.id, date),
    ]);
  } else await event;
  const [actual] = await db.select().from(recurringEvents).where(and(eq(recurringEvents.ruleId, rule.id), eq(recurringEvents.date, date)));
  return Response.json({ status: actual.status });
}

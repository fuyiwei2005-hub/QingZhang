import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { categoryBudgets } from "../../../db/schema";
import { expenses, validAmount } from "../../../lib/ledger-domain";
import { getAppUser } from "../../auth";
export async function GET() {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const rows = await getDb().select().from(categoryBudgets).where(eq(categoryBudgets.userId, user.id));
  return Response.json({ budgets: Object.fromEntries(rows.map((r) => [r.category, r.amount])) });
}
export async function PUT(request: Request) {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { budgets?: Record<string, number> } | null;
  if (!body?.budgets || Array.isArray(body.budgets) || typeof body.budgets !== "object" || Object.entries(body.budgets).some(([name, amount]) => !expenses.includes(name) || !validAmount(amount))) return Response.json({ error: "分类预算格式无效；留空表示不设置" }, { status: 400 });
  const db = getDb();
  const remove = db.delete(categoryBudgets).where(eq(categoryBudgets.userId, user.id));
  const values = Object.entries(body.budgets).map(([category, amount]) => ({ userId: user.id, category, amount }));
  if (values.length) await db.batch([remove, db.insert(categoryBudgets).values(values)]);
  else await remove;
  return Response.json({ budgets: body.budgets });
}

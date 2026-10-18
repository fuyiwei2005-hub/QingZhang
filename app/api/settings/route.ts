import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userSettings } from "../../../db/schema";
import { getAppUser } from "../../auth";

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const [settings] = await getDb().select().from(userSettings).where(eq(userSettings.userId, user.id));
  return Response.json({ monthlyBudget: settings?.monthlyBudget ?? null });
}

async function save(request: Request, initialize: boolean) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { monthlyBudget?: unknown } | null;
  const amount = body?.monthlyBudget;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 1e9) return Response.json({ error: "预算应为大于零且不超过十亿元的金额" }, { status: 400 });
  const monthlyBudget = Math.round(amount * 100) / 100;
  if (monthlyBudget < 0.01) return Response.json({ error: "预算至少为 0.01 元" }, { status: 400 });
  const values = { userId: user.id, monthlyBudget, updatedAt: new Date().toISOString() };
  const query = getDb().insert(userSettings).values(values);
  if (initialize) await query.onConflictDoNothing();
  else await query.onConflictDoUpdate({ target: userSettings.userId, set: { monthlyBudget, updatedAt: values.updatedAt } });
  const [settings] = await getDb().select().from(userSettings).where(eq(userSettings.userId, user.id));
  return Response.json({ monthlyBudget: settings.monthlyBudget });
}
export function POST(request: Request) { return save(request, true); }
export function PUT(request: Request) { return save(request, false); }

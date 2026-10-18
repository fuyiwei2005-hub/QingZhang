import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { transfers } from "../../../db/schema";
import { accounts, validAmount, validDate } from "../../../lib/ledger-domain";
import { getAppUser } from "../../auth";
export async function GET() {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  return Response.json({ transfers: await getDb().select().from(transfers).where(and(eq(transfers.userId, user.id), isNull(transfers.deletedAt))).orderBy(desc(transfers.occurredAt), desc(transfers.id)) });
}
export async function POST(request: Request) {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { fromAccount: string; toAccount: string; amount: number; date: string; note: string } | null;
  if (!body || !accounts.includes(body.fromAccount) || !accounts.includes(body.toAccount) || body.fromAccount === body.toAccount || !validAmount(body.amount) || !validDate(body.date) || typeof body.note !== "string" || body.note.length > 120) return Response.json({ error: "请核对转出账户、转入账户、日期和金额" }, { status: 400 });
  const [transfer] = await getDb().insert(transfers).values({ userId: user.id, fromAccount: body.fromAccount, toAccount: body.toAccount, amount: body.amount, occurredAt: `${body.date}T12:00:00Z`, note: body.note.trim() }).returning();
  return Response.json({ transfer }, { status: 201 });
}
export async function DELETE(request: Request) {
  const user = await getAppUser(); if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "无效转账" }, { status: 400 });
  const [row] = await getDb().update(transfers).set({ deletedAt: new Date().toISOString() }).where(and(eq(transfers.id, id), eq(transfers.userId, user.id))).returning({ id: transfers.id });
  return row ? Response.json({ ok: true }) : Response.json({ error: "转账不存在" }, { status: 404 });
}

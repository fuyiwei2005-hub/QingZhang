import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { notes, transactions, transfers } from "../../../db/schema";
import { getAppUser } from "../../auth";

export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const db = getDb();
  const [deletedTransactions, deletedNotes, deletedTransfers] = await Promise.all([
    db.select().from(transactions).where(and(eq(transactions.userId, user.id), isNotNull(transactions.deletedAt))).orderBy(desc(transactions.deletedAt)),
    db.select().from(notes).where(and(eq(notes.userId, user.id), isNotNull(notes.deletedAt))).orderBy(desc(notes.deletedAt)),
    db.select().from(transfers).where(and(eq(transfers.userId, user.id), isNotNull(transfers.deletedAt))).orderBy(desc(transfers.deletedAt)),
  ]);
  return Response.json({ transactions: deletedTransactions, notes: deletedNotes, transfers: deletedTransfers });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null) as { kind?: string; id?: number } | null;
  if (!body || !Number.isInteger(body.id) || body.id! < 1 || !["transaction", "note", "transfer"].includes(body.kind || "")) return Response.json({ error: "无效的恢复请求" }, { status: 400 });
  const db = getDb();
  const now = new Date().toISOString();
  const result = body.kind === "transaction"
    ? await db.update(transactions).set({ deletedAt: null, updatedAt: now }).where(and(eq(transactions.id, body.id!), eq(transactions.userId, user.id), isNotNull(transactions.deletedAt))).returning({ id: transactions.id })
    : body.kind === "transfer" ? await db.update(transfers).set({ deletedAt: null }).where(and(eq(transfers.id, body.id!), eq(transfers.userId, user.id), isNotNull(transfers.deletedAt))).returning({ id: transfers.id })
    : await db.update(notes).set({ deletedAt: null, updatedAt: now }).where(and(eq(notes.id, body.id!), eq(notes.userId, user.id), isNotNull(notes.deletedAt))).returning({ id: notes.id });
  if (!result.length) return Response.json({ error: "内容不存在或已恢复" }, { status: 404 });
  return Response.json({ ok: true });
}

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { wheels } from "../../../db/schema";
import { getAppUser } from "../../auth";
import { wheelInput } from "../../../lib/wheel";
export async function GET() {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  return Response.json({ wheels: await getDb().select().from(wheels).where(eq(wheels.userId, user.id)).orderBy(desc(wheels.updatedAt), desc(wheels.id)) });
}
export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const input = wheelInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "请填写名称，并添加 2～40 个选项；名称和每项最多 60 字" }, { status: 400 });
  const [wheel] = await getDb().insert(wheels).values({ ...input, userId: user.id }).returning();
  return Response.json({ wheel }, { status: 201 });
}
export async function PUT(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const input = wheelInput(await request.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id < 1 || !input) return Response.json({ error: "转盘内容无效，至少保留 2 个选项" }, { status: 400 });
  const [wheel] = await getDb().update(wheels).set({ ...input, updatedAt: new Date().toISOString() }).where(and(eq(wheels.id, id), eq(wheels.userId, user.id))).returning();
  return wheel ? Response.json({ wheel }) : Response.json({ error: "转盘不存在" }, { status: 404 });
}
export async function DELETE(request: Request) {
  const user = await getAppUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "无效转盘" }, { status: 400 });
  const [wheel] = await getDb().delete(wheels).where(and(eq(wheels.id, id), eq(wheels.userId, user.id))).returning({ id: wheels.id });
  return wheel ? Response.json({ ok: true }) : Response.json({ error: "转盘不存在" }, { status: 404 });
}

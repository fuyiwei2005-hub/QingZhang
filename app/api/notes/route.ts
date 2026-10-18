import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { notes } from "../../../db/schema";
import { getAppUser } from "../../auth";

async function userId() { return (await getAppUser())?.id ?? null; }
function noteInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as { title?: unknown; content?: unknown; pinned?: unknown; tags?: unknown; todos?: unknown };
  if (typeof body.title !== "string" || typeof body.content !== "string") return null;
  const title = body.title.trim();
  if (!title || title.length > 100 || body.content.length > 20000) return null;
  const tags = body.tags ?? [];
  const todos = body.todos ?? [];
  if ((body.pinned !== undefined && typeof body.pinned !== "boolean") || !Array.isArray(tags) || tags.length > 10 || tags.some((t) => typeof t !== "string" || !t.trim() || t.length > 20) || !Array.isArray(todos) || todos.length > 100 || todos.some((t) => !t || typeof t.id !== "string" || t.id.length > 64 || typeof t.text !== "string" || !t.text.trim() || t.text.length > 200 || typeof t.done !== "boolean") || new Set(todos.map((t) => t.id)).size !== todos.length) return null;
  return { title, content: body.content, pinned: Boolean(body.pinned), tags: [...new Set(tags.map((t: string) => t.trim()))] as string[], todos: todos as Array<{ id: string; text: string; done: boolean }> };
}

export async function GET() {
  const id = await userId();
  if (!id) return Response.json({ error: "请先登录" }, { status: 401 });
  const rows = await getDb().select().from(notes).where(and(eq(notes.userId, id), isNull(notes.deletedAt))).orderBy(desc(notes.pinned), desc(notes.updatedAt), desc(notes.id));
  return Response.json({ notes: rows });
}

export async function POST(request: Request) {
  const id = await userId();
  if (!id) return Response.json({ error: "请先登录" }, { status: 401 });
  const input = noteInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "请填写标题，正文不能超过 20000 字" }, { status: 400 });
  const [note] = await getDb().insert(notes).values({ ...input, userId: id }).returning();
  return Response.json({ note }, { status: 201 });
}

export async function PUT(request: Request) {
  const id = await userId();
  if (!id) return Response.json({ error: "请先登录" }, { status: 401 });
  const noteId = Number(new URL(request.url).searchParams.get("id"));
  const input = noteInput(await request.json().catch(() => null));
  if (!Number.isInteger(noteId) || noteId < 1 || !input) return Response.json({ error: "笔记内容无效" }, { status: 400 });
  const [note] = await getDb().update(notes).set({ ...input, updatedAt: new Date().toISOString() }).where(and(eq(notes.id, noteId), eq(notes.userId, id), isNull(notes.deletedAt))).returning();
  if (!note) return Response.json({ error: "笔记不存在" }, { status: 404 });
  return Response.json({ note });
}

export async function DELETE(request: Request) {
  const id = await userId();
  if (!id) return Response.json({ error: "请先登录" }, { status: 401 });
  const noteId = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(noteId) || noteId < 1) return Response.json({ error: "无效笔记" }, { status: 400 });
  const [note] = await getDb().update(notes).set({ deletedAt: new Date().toISOString() }).where(and(eq(notes.id, noteId), eq(notes.userId, id))).returning({ id: notes.id });
  if (!note) return Response.json({ error: "笔记不存在" }, { status: 404 });
  return Response.json({ ok: true });
}

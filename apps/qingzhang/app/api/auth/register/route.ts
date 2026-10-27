import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, hashPassword, isSecureRequest } from "../../../auth";

export async function POST(request: Request) {
  const body = await request.json() as { name?: string; email?: string; password?: string };
  const name = body.name?.trim().slice(0, 40) || ""; const email = body.email?.trim().toLowerCase() || ""; const password = body.password || "";
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return Response.json({ error: "请输入有效姓名、邮箱和至少 8 位密码" }, { status: 400 });
  if ((await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)).length) return Response.json({ error: "该邮箱已注册" }, { status: 409 });
  const { hash, salt } = await hashPassword(password); const id = crypto.randomUUID(); await getDb().insert(users).values({ id, name, email, passwordHash: hash, passwordSalt: salt }); await createSession(id, isSecureRequest(request)); return Response.json({ user: { id, name, email } }, { status: 201 });
}

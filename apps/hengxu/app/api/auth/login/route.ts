import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { createSession, isSecureRequest, verifyPassword } from "../../../auth";
export async function POST(request: Request) { const body = await request.json() as { email?: string; password?: string }; const email = body.email?.trim().toLowerCase() || ""; const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1); if (!user || !(await verifyPassword(body.password || "", user.passwordSalt, user.passwordHash))) return Response.json({ error: "邮箱或密码错误" }, { status: 401 }); await createSession(user.id, isSecureRequest(request)); return Response.json({ user: { id: user.id, name: user.name, email: user.email } }); }

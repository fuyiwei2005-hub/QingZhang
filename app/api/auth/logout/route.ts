import { clearSession, isSecureRequest } from "../../../auth";
export async function POST(request: Request) { await clearSession(isSecureRequest(request)); return Response.json({ ok: true }); }

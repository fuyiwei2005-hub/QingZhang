import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";

const COOKIE = "qingzhang_session";
const COOKIE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/";
const encoder = new TextEncoder();
function hex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function fromHex(value: string) { return new Uint8Array(value.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []); }
async function sha256(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
export async function hashPassword(password: string, salt = hex(crypto.getRandomValues(new Uint8Array(16)))) { const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(salt), iterations: 120000, hash: "SHA-256" }, key, 256); return { hash: hex(new Uint8Array(bits)), salt }; }
export async function verifyPassword(password: string, salt: string, expected: string) { const { hash } = await hashPassword(password, salt); if (hash.length !== expected.length) return false; let mismatch = 0; for (let i = 0; i < hash.length; i++) mismatch |= hash.charCodeAt(i) ^ expected.charCodeAt(i); return mismatch === 0; }
export function isSecureRequest(request: Request) { return new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"; }
export async function createSession(userId: string, secure: boolean) { const token = hex(crypto.getRandomValues(new Uint8Array(32))); const tokenHash = await sha256(token); const expires = new Date(Date.now() + 30 * 86400000); await getDb().insert(sessions).values({ tokenHash, userId, expiresAt: expires.toISOString() }); const jar = await cookies(); jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: COOKIE_PATH, expires }); }
export async function clearSession(secure: boolean) { const jar = await cookies(); const token = jar.get(COOKIE)?.value; if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token))); jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure, path: COOKIE_PATH, expires: new Date(0) }); }
export async function getAppUser() { const token = (await cookies()).get(COOKIE)?.value; if (!token) return null; const [row] = await getDb().select({ id: users.id, name: users.name, email: users.email, expiresAt: sessions.expiresAt }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.tokenHash, await sha256(token))).limit(1); if (!row || new Date(row.expiresAt) <= new Date()) return null; return { id: row.id, name: row.name, email: row.email }; }

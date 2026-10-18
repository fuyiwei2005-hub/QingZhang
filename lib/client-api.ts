import { appPath } from "./base-path";
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(appPath(path), { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试");
  return data;
}
export const field = "mt-1 w-full min-w-0 rounded-xl border border-[#dfe7dc] bg-[#fafcf9] px-3 py-2.5 text-sm";
export const card = "surface-card rounded-[26px] border p-5 md:p-6";

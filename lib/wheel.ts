export type WheelInput = { title: string; options: string[] };
export function wheelInput(value: unknown): WheelInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 60 || !Array.isArray(body.options) || body.options.length < 2 || body.options.length > 40 || body.options.some(v => typeof v !== "string" || !v.trim() || v.trim().length > 60)) return null;
  return { title: body.title.trim(), options: body.options.map(v => (v as string).trim()) };
}
// Rejection sampling prevents modulo bias; each option has the same probability.
export function randomWheelIndex(count: number): number {
  if (!Number.isInteger(count) || count < 2 || count > 40) throw new Error("Invalid wheel size");
  const limit = Math.floor(0x100000000 / count) * count;
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % count;
}

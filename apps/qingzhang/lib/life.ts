import { z } from "zod";
import { validAmount, validDate } from "./ledger-domain";
export const lifeKinds = ["shopping", "subscription", "goal", "debt", "anniversary", "habit"] as const;
export type LifeKind = typeof lifeKinds[number];
export const lifeNames: Record<LifeKind, string> = { shopping: "购物清单", subscription: "订阅缴费", goal: "存钱目标", debt: "借还款", anniversary: "纪念倒数", habit: "习惯打卡" };
const title = z.string().trim().min(1).max(60);
const note = z.string().trim().max(200).default("");
const date = z.string().refine(validDate, "日期无效");
const amount = z.number().refine(validAmount, "金额须为正数，最多两位小数");
const base = { title, note };
export const lifeInput = z.discriminatedUnion("kind", [
 z.object({ kind: z.literal("shopping"), ...base, group: title, amount: amount.nullable(), done: z.boolean() }),
 z.object({ kind: z.literal("subscription"), ...base, amount, date, frequency: z.enum(["monthly", "yearly"]), active: z.boolean() }),
 z.object({ kind: z.literal("goal"), ...base, amount, date: date.nullable() }),
 z.object({ kind: z.literal("debt"), ...base, amount, date: date.nullable(), direction: z.enum(["lent", "borrowed"]), person: title }),
 z.object({ kind: z.literal("anniversary"), ...base, date, yearly: z.boolean() }),
 z.object({ kind: z.literal("habit"), ...base, active: z.boolean() }),
]);
export type LifeData = z.infer<typeof lifeInput>;
export type LifeItem = { id: number; kind: LifeKind; data: LifeData; version: number };
export type LifeEvent = { id: number; itemId: number; date: string; amount: number; note: string };
export function moneyTotal(events: LifeEvent[], id: number) { return events.filter(e => e.itemId === id).reduce((s,e) => s + Math.round(e.amount * 100), 0) / 100; }
export function dayDiff(date: string, today: string) { return Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000); }
export function annualDate(date: string, today: string) {
 const year = Math.max(Number(today.slice(0,4)),Number(date.slice(0,4))); const [,month,day] = date.split("-").map(Number);
 const inYear = (y: number) => new Date(Date.UTC(y,month-1,Math.min(day,new Date(Date.UTC(y,month,0)).getUTCDate()),12)).toISOString().slice(0,10);
 const current = inYear(year); return current < today ? inYear(year + 1) : current;
}
export function nextBill(item: LifeItem, events: LifeEvent[]) {
 if (item.data.kind !== "subscription") return "";
 const {date, frequency} = item.data; const [y,m,d] = date.split("-").map(Number);
 const paid = new Set(events.filter(e => e.itemId === item.id).map(e => e.date));
 for (let i=0;i<1600;i++) {
  const anchor = new Date(Date.UTC(y+(frequency === "yearly" ? i : 0),m-1+(frequency === "monthly" ? i : 0),1,12));
  const last = new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+1,0)).getUTCDate();
  anchor.setUTCDate(Math.min(d,last)); const candidate = anchor.toISOString().slice(0,10);
  if (!paid.has(candidate)) return candidate;
 }
 return "";
}

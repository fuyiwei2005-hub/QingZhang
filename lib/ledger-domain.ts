export const accounts = ["微信", "支付宝", "银行卡", "现金"];
export const expenses = ["餐饮", "交通", "购物", "居住", "娱乐", "医疗", "通讯", "学习", "服饰", "人情", "日用", "其他"];
export const incomes = ["工资", "奖金", "兼职", "理财", "报销", "红包", "退款", "其他"];
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1970-01-01" && value <= "2100-12-31";
}
export function validAmount(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0.01 && value <= 1e9 && Math.abs(value * 100 - Math.round(value * 100)) < 0.0001; }
export type Entry = { type: "expense" | "income"; amount: number; category: string; account: string; note: string; date: string };
export function entryInput(value: unknown, categories: {expenses:string[];incomes:string[];accounts?:string[]} = { expenses, incomes, accounts }): Entry | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Entry;
  if (!["expense", "income"].includes(v.type) || !validAmount(v.amount) || !validDate(v.date) || !(categories.accounts || accounts).includes(v.account) || !(v.type === "income" ? categories.incomes : categories.expenses).includes(v.category) || typeof v.note !== "string" || v.note.length > 120) return null;
  return { type: v.type, amount: v.amount, category: v.category, account: v.account, note: v.note.trim(), date: v.date };
}
export function todayChina() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function shiftMonth(month: string, delta: number) { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + delta, 1, 12)).toISOString().slice(0, 7); }
export function occurrenceDates(start: string, frequency: string, until: string, end?: string | null) {
  const result: string[] = [];
  const [year, month, day] = start.split("-").map(Number);
  const stop = end && end < until ? end : until;
  for (let i = 0; i < 7000; i++) {
    let date: Date;
    if (frequency === "weekly") date = new Date(Date.UTC(year, month - 1, day + 7 * i, 12));
    else {
      const anchor = new Date(Date.UTC(year + (frequency === "yearly" ? i : 0), month - 1 + (frequency === "monthly" ? i : 0), 1, 12));
      const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12)).getUTCDate();
      date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(day, last), 12));
    }
    const key = date.toISOString().slice(0, 10);
    if (key > stop) break;
    result.push(key);
  }
  return result;
}

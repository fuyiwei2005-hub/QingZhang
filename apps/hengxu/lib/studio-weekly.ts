import { todayChina, validDate } from "./ledger-domain";
import { moneyCents as money, stagePaid, type StudioData } from "./studio-domain";
import { entryTotals } from "./studio-view";

export function offsetDate(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Financial amounts always come from ledger arithmetic, never model output.
export function weeklyReport(data: StudioData, end: string, projectId = "", today = todayChina()) {
  if (!validDate(end) || end > today || end < "1900-01-15") throw new Error("请选择有效的周报结束日期");
  if (projectId && !data.projects.some(p => p.id === projectId)) throw new Error("项目不存在");
  const from = offsetDate(end, -6), previousFrom = offsetDate(end, -13), previousTo = offsetDate(end, -7);
  const entries = data.entries.filter(e => !e.deletedAt && (!projectId || e.projectId === projectId));
  const rows = entries.filter(e => e.date >= from && e.date <= end);
  const previous = entryTotals(entries.filter(e => e.date >= previousFrom && e.date <= previousTo));
  const totals = entryTotals(rows);
  const categories = new Map<string, number>();
  rows.filter(e => e.type === "expense").forEach(e => categories.set(e.category, (categories.get(e.category) || 0) + e.amountCents));
  const costs = [...categories].map(([name, amount]) => ({ name, amount })).sort((a,b) => b.amount-a.amount);
  const pending = data.stages.filter(s => !projectId || s.projectId === projectId)
    .map(s => ({ ...s, remaining: Math.max(0, s.amountCents-stagePaid(data,s.id)), projectTitle: data.projects.find(p => p.id===s.projectId)?.title || "项目" }))
    .filter(s => s.remaining > 0);
  const overdue = pending.filter(s => s.dueDate && s.dueDate < today);
  const soon = pending.filter(s => s.dueDate && s.dueDate >= today && s.dueDate <= offsetDate(today, 7));
  const tasks = data.tasks.filter(t => !t.done && (!projectId || t.projectId === projectId) && t.dueDate && t.dueDate <= offsetDate(today,7));
  const scope = projectId ? data.projects.find(p => p.id===projectId)!.title : "全部经营记录（含日常经营）";
  const change = (current: number, before: number) => current===before ? "持平" : `${current>before?"增加":"减少"}${money(Math.abs(current-before))}`;
  const text = ["衡序 · 经营周报", scope, `收支范围：${from} 至 ${end}（近7日）`, `对比范围：${previousFrom} 至 ${previousTo}`,
    `实际收入：${money(totals.income)}，较前7日${change(totals.income,previous.income)}`,
    `实际支出：${money(totals.expense)}，较前7日${change(totals.expense,previous.expense)}`,
    `收支结余：${money(totals.balance)}，较前7日${change(totals.balance,previous.balance)}`,
    `依据：${rows.length} 笔有效收支；不包含回收站记录与未到账款项。`, "",
    "主要支出", ...(costs.length ? costs.map(c => `${c.name}：${money(c.amount)}`) : ["这段时间没有支出记录。"]), "",
    `当前跟进事项（截至 ${today}，并非历史周末快照）`,
    `逾期待收：${overdue.length} 期，${money(overdue.reduce((n,s)=>n+s.remaining,0))}`,
    ...overdue.map(s=>`• ${s.projectTitle} / ${s.title}：待收${money(s.remaining)}，约定${s.dueDate}`),
    `今天至未来7天约定回款：${soon.length} 期，${money(soon.reduce((n,s)=>n+s.remaining,0))}`,
    ...soon.map(s=>`• ${s.projectTitle} / ${s.title}：待收${money(s.remaining)}，约定${s.dueDate}`),
    `已到期或未来7天到期的未完成事项：${tasks.length} 项`,
    ...tasks.map(t=>`• ${data.projects.find(p=>p.id===t.projectId)?.title || "项目"} / ${t.title}：${t.dueDate}`), "",
    "以上为系统依据当前账本计算的摘要，不调用AI；收支结余不等于会计利润。历史收支修改后，重新生成的周报会随之变化。"
  ].join("\n");
  return { from, end, previousFrom, previousTo, totals, previous, rows, costs, overdue, soon, tasks, text };
}

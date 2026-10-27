"use client";
import { money } from "../lib/format-money";

import { useEffect, useState } from "react";
import { selectedTotals } from "../lib/transaction-selection";
import { usePhone } from "./mobile-layout";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Pencil, Plus, RefreshCw } from "lucide-react";

type Transaction = { id: number; type: "expense" | "income"; amount: number; category: string; account: string; note: string; occurredAt: string };
type Props = { rows: Transaction[]; onEdit: (row: Transaction) => void; onAdd: () => void; onSync: () => void };
type Group = { key: string; rows: Transaction[]; weeks: Map<string, Transaction[]> };

function datePart(row: Transaction) { return row.occurredAt.slice(0, 10); }
function weekStart(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
function weekLabel(month: string, monday: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const start = new Date(`${monday}T12:00:00Z`);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const from = start < first ? first : start;
  const to = end > last ? last : end;
  const label = (day: Date) => `${day.getUTCMonth() + 1}月${day.getUTCDate()}日`;
  return `${label(from)}—${label(to)}`;
}
function total(rows: Transaction[], type: Transaction["type"]) {
  return rows.filter((row) => row.type === type).reduce((sum, row) => sum + row.amount, 0);
}

export default function GroupedTransactionList({ rows, onEdit, onAdd, onSync }: Props) {
  const phone = usePhone(); const [selectedMonth, setSelectedMonth] = useState(""); const [selectedWeek, setSelectedWeek] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useEffect(() => {
    const available = new Set(rows.map(row => row.id));
    setSelected(current => {
      const next = new Set([...current].filter(id => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);
  const totals = selectedTotals(rows, selected);
  const toggle = (id: number) => setSelected(current => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const selectionBar = <div className={`mb-3 rounded-2xl border border-[#dce7dc] bg-[#f4f8f2] p-3 ${selecting ? "selection-summary" : ""}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <button type="button" className="rounded-lg px-2 py-2 font-medium text-[#1e5b3a]" onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}>{selecting ? "退出多选" : "多选计算收支"}</button>
      {selecting && <div className="flex gap-3"><button type="button" onClick={() => setSelected(new Set(rows.map(row => row.id)))}>全选筛选结果</button><button type="button" onClick={() => setSelected(new Set())}>清空</button></div>}
    </div>
    {selecting && <div role="status" aria-live="polite" className="mt-2 text-xs">
      <p className="mb-2 text-[#728373]">已选 {totals.count} 笔 · 可跨月、跨周勾选</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2"><span className="text-[#2e7a48]">收入 {money(totals.income)}</span><span className="text-[#be684f]">支出 {money(totals.expense)}</span><strong>结余 {money(totals.balance)}</strong></div>
    </div>}
  </div>;
  const checkbox = (row: Transaction) => selecting && <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-[#1e5b3a]" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`选择 ${datePart(row)} ${row.note || row.category} ${row.type === "income" ? "收入" : "支出"} ${row.amount.toFixed(2)}元`}/></label>;
  const groups = new Map<string, Group>();
  for (const row of [...rows].sort((a, b) => datePart(b).localeCompare(datePart(a)) || b.id - a.id)) {
    const month = datePart(row).slice(0, 7);
    let group = groups.get(month);
    if (!group) { group = { key: month, rows: [], weeks: new Map() }; groups.set(month, group); }
    group.rows.push(row);
    const monday = weekStart(datePart(row));
    const week = group.weeks.get(monday) || [];
    week.push(row);
    group.weeks.set(monday, week);
  }
  const months = [...groups.values()];
  const activeMonth = months.find(m => m.key === selectedMonth) || months[0];
  const weeks = activeMonth ? [...activeMonth.weeks.entries()] : [];
  const activeWeek = weeks.find(([key]) => key === selectedWeek) || weeks[0];
  if (phone) return <section className="surface-card rounded-2xl border p-4">{selectionBar}<div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">收支账目 · {rows.length} 笔</h2><button type="button" onClick={onSync} aria-label="立即同步"><RefreshCw size={17}/></button></div>{activeMonth ? <><div className="mb-3 grid grid-cols-2 gap-2"><select aria-label="账目月份" className="rounded-xl border p-2 text-sm" value={activeMonth.key} onChange={e => {setSelectedMonth(e.target.value); setSelectedWeek("");}}>{months.map(m => <option key={m.key} value={m.key}>{m.key} · {m.rows.length}笔</option>)}</select><select aria-label="账目周次" className="rounded-xl border p-2 text-xs" value={activeWeek?.[0]} onChange={e => setSelectedWeek(e.target.value)}>{weeks.map(([key]) => <option key={key} value={key}>{weekLabel(activeMonth.key,key)}</option>)}</select></div><p className="mb-2 text-xs text-[#78907b]">本月支出 {money(total(activeMonth.rows,"expense"))} · 收入 {money(total(activeMonth.rows,"income"))}</p>{(activeWeek?.[1] || []).map(row => <div key={row.id} className="flex items-center">{checkbox(row)}<button type="button" aria-pressed={selecting ? selected.has(row.id) : undefined} onClick={() => selecting ? toggle(row.id) : onEdit(row)} className={`flex w-full min-w-0 items-center justify-between gap-2 border-b py-3 text-left ${selecting && selected.has(row.id) ? "bg-[#edf5eb]" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-medium">{row.note || row.category}</span><span className="block break-words text-xs text-[#849384]">{datePart(row)} · {row.account}</span></span><span className="shrink-0 text-sm font-semibold">{row.type === "income" ? "+" : "−"}{money(row.amount)}</span></button></div>)}</> : <div className="py-10 text-center text-sm"><p>还没有账目</p><button onClick={onAdd} className="mt-3 text-green-800">记一笔</button></div>}</section>;

  return <section className="space-y-4">
    {selectionBar}
    <div className="flex items-center justify-between surface-card rounded-[24px] border border-[#e0e5dd] bg-white p-5">
      <div><h2 className="font-semibold">全部收支明细</h2><p className="mt-1 text-xs text-[#7a847a]">共 {rows.length} 笔 · 按月、按周展开查看</p></div>
      <button onClick={onSync} className="rounded-lg p-2 text-[#52745a]" aria-label="立即同步"><RefreshCw size={17} /></button>
    </div>
    {months.length === 0 && <div className="surface-card rounded-[24px] border border-[#e0e5dd] bg-white p-10 text-center"><p className="text-sm text-[#7a847a]">还没有账目</p><button onClick={onAdd} className="mt-3 inline-flex items-center gap-1 text-sm text-[#1e5b3a]"><Plus size={15}/>记下第一笔</button></div>}
    {months.map((month) => <details key={month.key} className="group/month overflow-hidden surface-card rounded-[24px] border border-[#e0e5dd] bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 marker:hidden"><ChevronDown size={18} className="shrink-0 text-[#64836a] transition-transform group-open/month:rotate-180"/><div className="min-w-0 flex-1"><h3 className="font-semibold">{month.key.slice(0, 4)}年{Number(month.key.slice(5))}月</h3><p className="text-xs text-[#819081]">{month.rows.length} 笔 · {month.weeks.size} 周</p></div><div className="text-right text-xs"><p className="text-[#be684f]">支出 {money(total(month.rows, "expense"))}</p><p className="mt-1 text-[#368258]">收入 {money(total(month.rows, "income"))}</p></div></summary>
      <div className="space-y-3 border-t border-[#edf0eb] bg-[#fafbf9] p-3 md:p-5">{[...month.weeks.entries()].map(([monday, weekRows]) => <details key={monday} className="group/week overflow-hidden rounded-2xl border border-[#e2e8df] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden"><ChevronDown size={16} className="shrink-0 text-[#7e947f] transition-transform group-open/week:rotate-180"/><div className="min-w-0 flex-1"><p className="text-sm font-medium">{weekLabel(month.key, monday)}</p><p className="text-xs text-[#899589]">{weekRows.length} 笔</p></div><div className="text-right text-xs text-[#788678]"><p>支出 {money(total(weekRows, "expense"))}</p><p>收入 {money(total(weekRows, "income"))}</p></div></summary>
        <div className="border-t border-[#edf0eb]">{weekRows.map((row) => <div key={row.id} className="flex items-center">{checkbox(row)}<button type="button" aria-pressed={selecting ? selected.has(row.id) : undefined} onClick={() => selecting ? toggle(row.id) : onEdit(row)} className="flex w-full min-w-0 items-center gap-3 border-b border-[#edf0eb] px-4 py-3 text-left last:border-0 hover:bg-[#fafbf9]"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${row.type === "income" ? "bg-[#e2f1e5] text-[#2e7a48]" : "bg-[#f5eee2] text-[#a76723]"}`}>{row.type === "income" ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{row.note || row.category}</p><p className="break-words text-xs text-[#818a81]">{row.category} · {row.account}{row.id < 0 ? " · 待同步" : ""}</p></div><div className="text-right"><p className={`text-sm font-semibold ${row.type === "income" ? "text-[#2e7a48]" : ""}`}>{row.type === "income" ? "+" : "-"} {money(row.amount)}</p><p className="text-xs text-[#8a938a]">{datePart(row)}</p></div><Pencil className="hidden text-[#96a096] sm:block" size={14}/></button></div>)}</div>
      </details>)}</div>
    </details>)}
  </section>;
}

"use client";
import { MobileSections, usePhone } from "./mobile-layout";
import { useMemo, useState } from "react";
import { emptyFilter, filterTransactions } from "../lib/transaction-filter";
import GroupedTransactionList from "./transaction-groups";
type Transaction = { id: number; type: "expense" | "income"; amount: number; category: string; account: string; note: string; occurredAt: string };
type Props = { rows: Transaction[]; onEdit: (row: Transaction) => void; onAdd: () => void; onSync: () => void };
const inputClass = "mt-1.5 h-11 w-full min-w-0 rounded-xl border border-[#dfe7dc] bg-[#fafcf9] px-3 text-sm text-[#243e2c]";
export default function TransactionBrowser(props: Props) {
  const phone = usePhone(); const [advanced, setAdvanced] = useState(false);
  const [filter, setFilter] = useState({ ...emptyFilter });
  const matches = useMemo(() => filterTransactions(props.rows, filter), [props.rows, filter]);
  const active = Object.values(filter).some(Boolean);
  const invalid = (filter.from && filter.to && filter.from > filter.to) || (filter.min && filter.max && Number(filter.min) > Number(filter.max));
  const change = (key: keyof typeof filter, value: string) => setFilter((current) => ({ ...current, [key]: value }));
  return <MobileSections initial={1} labels={["搜索筛选", "收支账目"]} className="space-y-5"><section className="filter-card surface-card rounded-[24px] border p-5 md:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">搜索与筛选</h2><p className="mt-1 text-xs text-[#7b8b7c]">找到 {matches.length} / {props.rows.length} 笔账目</p></div><button onClick={() => setFilter({ ...emptyFilter })} disabled={!active} className="text-sm text-[#36734c] disabled:opacity-40">清除筛选</button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <label className="text-xs text-[#758575]">关键词<input className={inputClass} value={filter.query} onChange={(e) => change("query", e.target.value)} placeholder="搜索备注、分类、账户"/></label>
    <label className="text-xs text-[#758575]">收支类型<select className={inputClass} value={filter.type} onChange={(e) => change("type", e.target.value)}><option value="">全部类型</option><option value="expense">支出</option><option value="income">收入</option></select></label>
    <label className="text-xs text-[#758575]">分类<select className={inputClass} value={filter.category} onChange={(e) => change("category", e.target.value)}><option value="">全部分类</option>{[...new Set(props.rows.map((row) => row.category))].sort().map((category) => <option key={category}>{category}</option>)}</select></label>
    <label className="text-xs text-[#758575]">账户<select className={inputClass} value={filter.account} onChange={(e) => change("account", e.target.value)}><option value="">全部账户</option>{[...new Set(props.rows.map((row) => row.account))].sort().map((account) => <option key={account}>{account}</option>)}</select></label>
    </div><details className="filter-advanced" open={!phone || advanced} onToggle={e => { if (phone) setAdvanced(e.currentTarget.open); }}><summary>日期与金额范围{(filter.from || filter.to || filter.min || filter.max) ? " · 已设置" : ""}</summary><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <label className="text-xs text-[#758575]">开始日期<input type="date" className={inputClass} value={filter.from} onChange={(e) => change("from", e.target.value)}/></label>
    <label className="text-xs text-[#758575]">结束日期<input type="date" className={inputClass} value={filter.to} onChange={(e) => change("to", e.target.value)}/></label>
    <label className="text-xs text-[#758575]">最低金额<input type="number" min="0" step="0.01" className={inputClass} value={filter.min} onChange={(e) => change("min", e.target.value)} placeholder="不限"/></label>
    <label className="text-xs text-[#758575]">最高金额<input type="number" min="0" step="0.01" className={inputClass} value={filter.max} onChange={(e) => change("max", e.target.value)} placeholder="不限"/></label>
    </div></details>{invalid && <p role="alert" className="mt-3 text-sm text-red-700">请检查日期或金额范围，起始值不能大于结束值。</p>}
    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#e8ede4] pt-4 text-sm text-[#6b7e6d]"><span>筛选支出 ¥ {matches.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0).toFixed(2)}</span><span>筛选收入 ¥ {matches.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0).toFixed(2)}</span></div></section>
    {active && !matches.length ? <div className="surface-card rounded-[24px] border p-10 text-center text-sm text-[#7b8b7c]">没有符合条件的账目，试试调整筛选条件。</div> : <GroupedTransactionList {...props} rows={matches}/>}
  </MobileSections>;
}

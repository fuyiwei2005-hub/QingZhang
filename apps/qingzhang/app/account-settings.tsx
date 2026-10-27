"use client";
import { CategorySettings } from "./category-context";
import { MobileSections } from "./mobile-layout";
import { FormEvent, useEffect, useState } from "react";
import { Download, LogOut, Trash2 } from "lucide-react";
type Row = { type: string; amount: number; category: string; account: string; note: string; occurredAt: string };
export default function SettingsPanel({ user, budget, onBudget, budgetError, rows, onLogout, onTrash, categories }: { user: { name: string; email: string }; budget: number; onBudget: (value: number) => Promise<void>; budgetError: string; rows: Row[]; onLogout: () => void; onTrash: () => void; categories: string[] }) {
  const [input, setInput] = useState(String(budget));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setInput(String(budget)); }, [budget, dirty]);
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    const amount = Number(input);
    if (!input.trim() || !Number.isFinite(amount) || amount < 0.01 || amount > 1e9) { setError("请输入 0.01 元到十亿元之间的预算"); return; }
    setSaving(true);
    try { await onBudget(amount); setDirty(false); setMessage("预算已保存并同步到账号"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "预算保存失败，请重试"); }
    finally { setSaving(false); }
  }
  function exportRows() {
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = ["类型,金额,分类,账户,备注,日期", ...rows.map((row) => [row.type === "income" ? "收入" : "支出", row.amount, row.category, row.account, row.note, row.occurredAt.slice(0, 10)].map(cell).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `青账-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <MobileSections labels={["个人", "预算", "数据", "分类 / 账户"]} className="settings-sections grid gap-6 lg:grid-cols-2">
    <section className="surface-card rounded-[26px] border p-6"><h2 className="mb-5 font-semibold">账户信息</h2><p className="font-medium">{user.name}</p><p className="mt-1 text-sm text-[#7c867c]">{user.email}</p><button onClick={onLogout} className="mt-6 flex items-center gap-2 text-sm text-red-600"><LogOut size={16}/>退出当前账号</button></section>
    <section className="surface-card rounded-[26px] border p-6"><h2 className="font-semibold">预算设置</h2><p className="mb-5 mt-1 text-xs text-[#7d8c7d]">手机和电脑登录同一账号时共用此预算，切回页面时自动刷新。</p><form onSubmit={save} noValidate><label className="block text-sm text-[#687368]">每月总预算<input type="text" inputMode="decimal" value={input} onChange={(e) => { setInput(e.target.value); setDirty(true); setMessage(""); }} className="mt-2 w-full rounded-xl border border-[#dfe5dc] px-4 py-3"/></label><button disabled={saving} className="ledger-primary-button mt-3 w-full rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? "保存中…" : "保存预算"}</button>{(error || budgetError) && <p role="alert" className="mt-2 text-sm text-red-700">{error || budgetError}</p>}{message && <p role="status" className="mt-2 text-sm text-[#52745a]">{message}</p>}</form></section>
    <section className="surface-card rounded-[26px] border p-6"><h2 className="font-semibold">数据保护</h2><p className="mt-2 text-sm leading-7 text-[#7c897b]">账目和笔记删除后进入回收站，可随时恢复。建议定期导出账目，保留一份自己的副本。</p><button onClick={onTrash} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d6ded3] py-3 text-sm font-medium"><Trash2 size={17}/>打开回收站</button><button onClick={exportRows} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d6ded3] py-3 text-sm font-medium"><Download size={17}/>导出账目 CSV</button><p className="mt-3 text-xs text-[#8c9888]">CSV 仅含有效账目；完整备份包含笔记、预算和回收站。</p></section>
    <CategorySettings />
  </MobileSections>;
}

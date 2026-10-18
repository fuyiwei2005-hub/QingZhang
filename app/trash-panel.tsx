"use client";
import { MobileList } from "./mobile-layout";
import { useCallback, useEffect, useState } from "react";
import { appPath } from "../lib/base-path";
type DeletedTransaction = { id: number; note: string; category: string; amount: number; type: string; occurredAt: string; deletedAt: string };
type DeletedNote = { id: number; title: string; content: string; deletedAt: string };
export default function TrashPanel({ onRestore }: { onRestore: () => Promise<void> }) {
  const [data, setData] = useState<{ transactions: DeletedTransaction[]; notes: DeletedNote[]; transfers: Array<{ id: number; fromAccount: string; toAccount: string; amount: number; deletedAt: string }> }>({ transactions: [], notes: [], transfers: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(appPath("/api/trash"), { cache: "no-store" });
    if (!response.ok) throw new Error("回收站加载失败，请重试");
    setData(await response.json());
  }, []);
  useEffect(() => { load().catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }, [load]);
  async function restore(kind: string, id: number) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(appPath("/api/trash"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "恢复失败");
      await load(); await onRestore(); setMessage("已恢复，可在账目明细、账户管理或记事本中查看。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "恢复失败，请重试"); }
    finally { setBusy(false); }
  }
  const items = [...(data.transfers || []).map((r) => ({ kind: "transfer", id: r.id, title: `${r.fromAccount} → ${r.toAccount}`, detail: `转账 ¥${r.amount.toFixed(2)}`, deletedAt: r.deletedAt })), ...data.transactions.map((row) => ({ kind: "transaction", id: row.id, title: row.note || row.category, detail: `${row.occurredAt.slice(0, 10)} · ${row.category} · ${row.type === "income" ? "+" : "-"}¥${row.amount.toFixed(2)}`, deletedAt: row.deletedAt })), ...data.notes.map((row) => ({ kind: "note", id: row.id, title: row.title, detail: row.content.slice(0, 120) || "暂无正文", deletedAt: row.deletedAt }))].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return <section className="surface-card rounded-[26px] border p-5 md:p-7"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-semibold">回收站</h2><p className="mt-1 text-sm text-[#7d8c7d]">已删除的账目、转账和笔记保留在这里，可随时恢复。</p></div><button disabled={busy} onClick={() => { setLoading(true); setError(""); load().catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }} className="shrink-0 text-sm text-[#38754c]">刷新</button></div>{error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mb-4 rounded-xl bg-[#edf5e9] p-3 text-sm text-[#36744a]">{message}</p>}{loading ? <p className="py-10 text-center text-sm text-[#829080]">正在加载…</p> : items.length ? <div className="space-y-3">{<MobileList items={items} render={(item) => <div key={`${item.kind}-${item.id}`} className="flex items-center gap-4 rounded-2xl border border-[#e2eade] bg-[#fafcf9] p-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 truncate text-xs text-[#7d8c7d]">{item.detail}</p><p className="mt-2 text-[11px] text-[#93a08f]">{item.kind === "note" ? "笔记" : item.kind === "transfer" ? "转账" : "账目"} · 删除于 {new Date(item.deletedAt).toLocaleString("zh-CN")}</p></div><button disabled={busy} onClick={() => restore(item.kind, item.id)} className="rounded-xl border border-[#bbd4bb] bg-white px-4 py-2 text-sm text-[#347048] disabled:opacity-50">恢复</button></div>}/>}</div> : <p className="py-16 text-center text-sm text-[#839180]">回收站是空的</p>}</section>;
}

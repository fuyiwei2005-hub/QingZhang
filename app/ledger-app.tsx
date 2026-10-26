"use client";
import { appPath } from "../lib/base-path";

import { BarChart3, CircleDot, CalendarDays, Eye, EyeOff, ArrowUpRight, Bus, Coffee, FileText, Film, Gift, GraduationCap, HeartPulse, Home, Landmark, LogOut, Menu, MoreHorizontal, Phone, Plus, RefreshCw, Settings, Shirt, ShoppingBag, Trash2, Utensils, WalletCards, WifiOff, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { parseMoneyExpression } from "../lib/money-expression";
import { MobileSections, MobileList } from "./mobile-layout";
import TransactionBrowser from "./transaction-browser";
import TrashPanel from "./trash-panel";
import SettingsPanel from "./account-settings";
import NotesPanel from "./notes-panel";
import WheelPanel from "./wheel-panel";
import LifePanel from "./life-panel";
import AccountManager from "./account-manager";
import RecurringPanel from "./recurring-panel";
import CategoryBudgetPanel from "./category-budget-panel";
import { shiftMonth, todayChina } from "../lib/ledger-domain";

type Transaction = { id: number; type: "expense" | "income"; amount: number; category: string; account: string; note: string; occurredAt: string };
type Draft = Omit<Transaction, "id">;
type PendingOperation = { key: string; method: "POST" | "PUT" | "DELETE"; id?: number; body?: Draft };
type SyncState = "loading" | "synced" | "pending" | "offline" | "error";
type View = "overview" | "transactions" | "stats" | "accounts" | "notes" | "settings" | "trash" | "recurring" | "wheels" | "life";

const ACCOUNTS = ["微信", "支付宝", "银行卡", "现金"];
const EXPENSE_CATEGORIES = [
  { name: "餐饮", icon: Utensils, color: "#f59e0b" }, { name: "交通", icon: Bus, color: "#60a5fa" },
  { name: "购物", icon: ShoppingBag, color: "#f472b6" }, { name: "居住", icon: Home, color: "#a78bfa" },
  { name: "娱乐", icon: Film, color: "#fb7185" }, { name: "医疗", icon: HeartPulse, color: "#34d399" },
  { name: "通讯", icon: Phone, color: "#22d3ee" }, { name: "学习", icon: GraduationCap, color: "#818cf8" },
  { name: "服饰", icon: Shirt, color: "#e879f9" }, { name: "人情", icon: Gift, color: "#f97316" },
  { name: "日用", icon: Coffee, color: "#84cc16" }, { name: "其他", icon: MoreHorizontal, color: "#94a3b8" },
];
const INCOME_CATEGORIES = ["工资", "奖金", "兼职", "理财", "报销", "红包", "退款", "其他"];
const CACHE_KEY = "qingzhang.transactions.v2";
const QUEUE_KEY = "qingzhang.sync-queue.v2";
const BUDGET = 5000;

function readJson<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; } }
function localDateValue(value = new Date()) { const offset = value.getTimezoneOffset() * 60000; return new Date(value.getTime() - offset).toISOString().slice(0, 10); }
function draftFor(row?: Transaction): Draft { return row ? { type: row.type, amount: row.amount, category: row.category, account: row.account, note: row.note, occurredAt: row.occurredAt } : { type: "expense", amount: 0, category: "餐饮", account: "微信", note: "", occurredAt: new Date().toISOString() }; }

export default function LedgerApp({ user }: { user: { name: string; email: string } }) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFor());
  const [mobileNav, setMobileNav] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [hideAmounts, setHideAmounts] = useState(false);
  const [budget, setBudget] = useState(BUDGET);
  const [budgetError, setBudgetError] = useState("");
  const cacheKey = `${CACHE_KEY}:${user.email}`;
  const queueKey = `${QUEUE_KEY}:${user.email}`;

  const saveLocal = useCallback((next: Transaction[]) => { setRows(next); localStorage.setItem(cacheKey, JSON.stringify(next)); }, [cacheKey]);
  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) { setSyncState("offline"); return; }
    const queue = readJson<PendingOperation[]>(queueKey, []); if (!queue.length) { setSyncState("synced"); return; }
    setSyncState("pending"); const remaining: PendingOperation[] = [];
    for (const operation of queue) {
      try {
        const url = operation.id ? `/api/transactions?id=${operation.id}` : "/api/transactions";
        const response = await fetch(appPath(url), { method: operation.method, headers: { "Content-Type": "application/json" }, body: operation.body ? JSON.stringify(operation.body) : undefined });
        if (!response.ok) throw new Error("sync failed");
        if (operation.method === "POST") { const data = await response.json() as { transaction: Transaction }; setRows((current) => { const next = current.map((row) => row.id === Number(operation.key) ? data.transaction : row); localStorage.setItem(cacheKey, JSON.stringify(next)); return next; }); }
      } catch { remaining.push(operation); }
    }
    localStorage.setItem(queueKey, JSON.stringify(remaining)); setSyncState(remaining.length ? "error" : "synced");
  }, [cacheKey, queueKey]);

  useEffect(() => {
    const cached = readJson<Transaction[]>(cacheKey, []); if (cached.length) setRows(cached);
    flushQueue().then(async () => { if (readJson<PendingOperation[]>(queueKey, []).length) return; const res = await fetch(appPath("/api/transactions"), { cache: "no-store" }); if (!res.ok) throw new Error("sync failed"); const data = await res.json() as { transactions: Transaction[] }; saveLocal(data.transactions); }).catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
    const online = () => flushQueue(); const offline = () => setSyncState("offline"); window.addEventListener("online", online); window.addEventListener("offline", offline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(appPath("/sw.js")).catch(() => undefined);

    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [flushQueue, saveLocal]);

  const refreshRows = useCallback(async () => {
    await flushQueue();
    if (readJson<PendingOperation[]>(queueKey, []).length) throw new Error("请先完成待同步账目，再恢复内容");
    const response = await fetch(appPath("/api/transactions"), { cache: "no-store" });
    if (!response.ok) throw new Error("账目刷新失败，请重试");
    const data = await response.json() as { transactions: Transaction[] }; saveLocal(data.transactions);
  }, [flushQueue, queueKey, saveLocal]);
  const refreshBudget = useCallback(async () => {
    try {
      let response = await fetch(appPath("/api/settings"), { cache: "no-store" });
      if (!response.ok) throw new Error("预算同步失败，请检查网络后重试");
      let data = await response.json() as { monthlyBudget: number | null };
      if (data.monthlyBudget === null) {
        const legacy = Number(localStorage.getItem(`qingzhang.budget:${user.email}`) || localStorage.getItem("qingzhang.budget"));
        response = await fetch(appPath("/api/settings"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthlyBudget: Number.isFinite(legacy) && legacy >= 0.01 && legacy <= 1e9 ? legacy : BUDGET }) });
        if (!response.ok) throw new Error("预算初始化失败，请重试");
        data = await response.json();
      }
      if (data.monthlyBudget !== null) { setBudget(data.monthlyBudget); localStorage.setItem(`qingzhang.budget:${user.email}`, String(data.monthlyBudget)); }
      setBudgetError("");
    } catch (cause) { setBudgetError(cause instanceof Error ? cause.message : "预算同步失败"); }
  }, [user.email]);
  useEffect(() => {
    refreshBudget();
    const focus = () => { refreshBudget(); };
    window.addEventListener("focus", focus);
    const visible = () => { if (!document.hidden) refreshBudget(); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); };
  }, [refreshBudget]);
  async function saveBudget(value: number) {
    const response = await fetch(appPath("/api/settings"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthlyBudget: value }) });
    const data = await response.json() as { monthlyBudget: number; error?: string };
    if (!response.ok) throw new Error(data.error || "预算保存失败");
    setBudget(data.monthlyBudget); setBudgetError(""); localStorage.setItem(`qingzhang.budget:${user.email}`, String(data.monthlyBudget));
  }

  const now = new Date(); const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthRows = useMemo(() => rows.filter((row) => row.occurredAt.startsWith(monthKey)), [rows, monthKey]);
  const totals = useMemo(() => monthRows.reduce((sum, row) => { sum[row.type] += row.amount; return sum; }, { expense: 0, income: 0 }), [monthRows]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 6 + index); const key = localDateValue(date); return { key, label: index === 6 ? "今天" : `${date.getMonth() + 1}/${date.getDate()}`, total: rows.filter((row) => row.type === "expense" && row.occurredAt.startsWith(key)).reduce((sum, row) => sum + row.amount, 0) }; }), [rows]);
  const weekMax = Math.max(...week.map((day) => day.total), 1);
  const categoryTotals = useMemo(() => EXPENSE_CATEGORIES.map((item) => ({ ...item, total: monthRows.filter((row) => row.type === "expense" && row.category === item.name).reduce((sum, row) => sum + row.amount, 0) })).sort((a, b) => b.total - a.total), [monthRows]);
  const budgetPercent = Math.min(100, Math.round(totals.expense / budget * 100));

  async function logout() { await fetch(appPath("/api/auth/logout"), { method: "POST" }); localStorage.removeItem(cacheKey); location.reload(); }
  function navigate(next: View) { setView(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function openEditor(row?: Transaction) { setEditingId(row?.id ?? null); setDraft(draftFor(row)); setDeleteConfirm(false); setDialog(true); }
  function enqueue(operation: PendingOperation) { const queue = readJson<PendingOperation[]>(queueKey, []); localStorage.setItem(queueKey, JSON.stringify([...queue, operation])); setSyncState(navigator.onLine ? "pending" : "offline"); setTimeout(flushQueue, 0); }
  function submit(event: FormEvent, amount: number) {
    event.preventDefault(); if (!Number.isFinite(amount) || amount <= 0) return;
    const completed = { ...draft, amount };
    if (editingId !== null) { const next = rows.map((row) => row.id === editingId ? { ...completed, id: editingId } : row); saveLocal(next); enqueue({ key: String(editingId), method: "PUT", id: editingId, body: completed }); }
    else { const tempId = -Date.now(); saveLocal([{ ...completed, id: tempId }, ...rows]); enqueue({ key: String(tempId), method: "POST", body: completed }); }
    setDialog(false);
  }
  function removeCurrent() { if (editingId === null) return; if (editingId < 0) { window.alert("请先联网完成这笔账目的同步，再移入回收站。"); return; } saveLocal(rows.filter((row) => row.id !== editingId)); if (editingId > 0) enqueue({ key: `delete-${editingId}`, method: "DELETE", id: editingId }); setDialog(false); }

  return <main className="ledger-shell min-h-screen pb-20 text-[#182018] lg:pb-0">
    {mobileNav && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" aria-label="关闭菜单遮罩" onClick={() => setMobileNav(false)} />}
    <aside className={`ledger-sidebar fixed inset-y-0 left-0 z-40 w-64 border-r p-5 transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-10 flex items-center justify-between"><Brand /><button className="lg:hidden" onClick={() => setMobileNav(false)} aria-label="关闭菜单"><X size={20} /></button></div>
      <nav className="max-h-[calc(100dvh-190px)] space-y-2 overflow-y-auto scrollbar-thin"><Nav icon={Home} label="总览" active={view === "overview"} onClick={() => navigate("overview")} /><Nav icon={WalletCards} label="账目明细" active={view === "transactions"} onClick={() => navigate("transactions")} /><Nav icon={BarChart3} label="统计分析" active={view === "stats"} onClick={() => navigate("stats")} /><Nav icon={Landmark} label="账户管理" active={view === "accounts"} onClick={() => navigate("accounts")} /><Nav icon={CalendarDays} label="周期账单" active={view === "recurring"} onClick={() => navigate("recurring")} /><Nav icon={FileText} label="记事本" active={view === "notes"} onClick={() => navigate("notes")} /><Nav icon={Gift} label="生活工具" active={view === "life"} onClick={() => navigate("life")} /><Nav icon={CircleDot} label="转盘抽签" active={view === "wheels"} onClick={() => navigate("wheels")} /><Nav icon={Trash2} label="回收站" active={view === "trash"} onClick={() => navigate("trash")} /><Nav icon={Settings} label="设置" active={view === "settings"} onClick={() => navigate("settings")} /></nav>
      <div className="ledger-profile absolute bottom-5 left-5 right-5 rounded-2xl border p-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#dcecdf] font-semibold text-[#1e5b3a]">{user.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><SyncLabel state={syncState} /></div><button onClick={logout} aria-label="退出登录"><LogOut size={17} /></button></div></div>
    </aside>

    <section className="ledger-workspace lg:pl-64">
      <header className={`${view === "overview" ? "home-header " : ""}ledger-header sticky top-0 z-20 flex h-20 items-center justify-between border-b px-5 backdrop-blur-xl md:px-9`}><div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="打开菜单"><Menu /></button><div><p className="text-xs tracking-[.16em] text-[#788378]">{now.getFullYear()}年{now.getMonth() + 1}月<span className="hidden sm:inline"> · PERSONAL LEDGER</span></p><h1 className="text-lg font-semibold tracking-tight md:text-xl">{{ overview: "今天也从容记账", transactions: "账目明细", stats: "统计分析", accounts: "账户管理", notes: "记事本", wheels: "转盘抽签", life: "生活工具", recurring: "周期账单", trash: "回收站", settings: "设置" }[view]}</h1></div></div><div className="flex items-center gap-2">{view !== "overview" && view !== "settings" && view !== "notes" && view !== "trash" && view !== "recurring" && view !== "wheels" && view !== "life" && <button onClick={() => openEditor()} className="ledger-primary-button flex shrink-0 whitespace-nowrap h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white"><Plus size={18} />记一笔</button>}</div></header>
      <div className={`${view === "overview" ? "home-content " : ""}ledger-content mx-auto max-w-7xl space-y-6 p-5 md:p-9`}>
        {view === "overview" && <MobileSections labels={["收支", "预算", "趋势"]} className="home-mobile-pages space-y-6"><div className="home-main-page space-y-5">
        <section className="home-banner"><div><span className="home-kicker">把生活，记得清清楚楚</span><h2>青账<span>我的生活账本</span></h2><p>{now.getFullYear()} 年 {now.getMonth() + 1} 月 · 已记录 {monthRows.length} 笔收支</p></div><WalletCards className="home-banner-icon" size={120}/></section>
        <section className="home-summary surface-card">
          <div className="flex items-center justify-between gap-3"><p className="font-medium text-[#cb655e]">本月支出（元）</p><button onClick={() => navigate("accounts")} className="home-pill">账户 <ArrowUpRight size={14}/></button></div>
          <div className="my-4 flex min-w-0 items-center justify-between gap-2"><p className="home-amount tabular-nums">{hideAmounts ? "••••••" : money(totals.expense)}</p><button className="home-eye" onClick={() => setHideAmounts(!hideAmounts)} aria-label={hideAmounts ? "显示首页金额" : "隐藏首页金额"} aria-pressed={hideAmounts}>{hideAmounts ? <EyeOff size={22}/> : <Eye size={22}/>}</button></div>
          <div className="grid grid-cols-2 gap-4 border-b border-[#edf0eb] pb-6"><div><p className="text-xs text-[#849086]">本月收入</p><p className="mt-2 break-all text-lg font-semibold tabular-nums">{hideAmounts ? "••••" : money(totals.income)}</p></div><div><p className="text-xs text-[#849086]">本月结余</p><p className="mt-2 break-all text-lg font-semibold tabular-nums">{hideAmounts ? "••••" : money(totals.income - totals.expense)}</p></div></div>
          <button onClick={() => openEditor()} className="home-record"><Plus size={22}/>记一笔</button>
          <div className="mt-4 flex items-center justify-between text-xs text-[#859087]"><span>随手记账，心中有数</span><SyncLabel state={syncState}/></div>
        </section>
        <section className="home-shortcuts" aria-label="常用功能">{[{icon: WalletCards, label: "账目明细", target: "transactions"}, {icon: CalendarDays, label: "周期账单", target: "recurring"}, {icon: Landmark, label: "账户管理", target: "accounts"}, {icon: FileText, label: "记事本", target: "notes"}].map(item => <button key={item.target} onClick={() => navigate(item.target as View)}><span><item.icon size={23}/></span>{item.label}</button>)}</section>
        </div><section className="surface-card rounded-[26px] border p-5 md:p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">本月预算</h2><button onClick={() => navigate("settings")} className="home-pill">修改预算 <ArrowUpRight size={14}/></button></div><div className="my-4 flex flex-wrap items-end justify-between gap-2"><div><p className="mb-1 text-xs text-[#849086]">{totals.expense > budget ? "已超出预算" : "剩余可用"}</p><p className="text-2xl font-semibold tabular-nums" style={{color: totals.expense > budget ? "#cb655e" : undefined}}>{hideAmounts ? "••••" : money(Math.abs(budget - totals.expense))}</p></div><p className="text-xs text-[#849086]">总预算 {hideAmounts ? "••••" : money(budget)}</p></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0eb]"><div className="h-full rounded-full bg-[#93bb98]" style={{width: `${budgetPercent}%`}}/></div>{budgetError && <p role="alert" className="mt-3 text-xs text-red-600">{budgetError}</p>}</section>
        <details className="home-details" open><summary className="flex items-center justify-between rounded-2xl px-1 py-3 font-semibold">收支趋势与分类<span className="text-xs font-normal text-[#849086]">点击展开 / 收起</span></summary><div className="mt-3">
        <MobileSections labels={["七日趋势", "分类概览"]} className="grid gap-6 xl:grid-cols-[1.45fr_.75fr]"><div className="surface-card rounded-[26px] border border-[#e0e5dd] bg-white p-5 md:p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">真实支出趋势</h2><p className="text-xs text-[#7a847a]">最近 7 天按账目汇总</p></div><SyncLabel state={syncState} /></div><div className="flex h-52 items-end justify-between gap-3 border-b border-[#e7ebe4] px-2">{week.map((day) => <div key={day.key} className="group flex h-full flex-1 items-end justify-center" title={`${day.label} ${money(day.total)}`}><div className="ledger-chart-bar w-full max-w-9 rounded-t-lg transition-all" style={{ height: day.total ? `${Math.max(8, day.total / weekMax * 100)}%` : "3px" }} /></div>)}</div><div className="mt-3 flex justify-between px-1 text-[10px] text-[#889288]">{week.map((day) => <span key={day.key}>{day.label}</span>)}</div></div>
          <div className="surface-card rounded-[26px] border border-[#e0e5dd] bg-white p-5 md:p-6"><div className="mb-5"><h2 className="font-semibold">支出分类</h2><p className="text-xs text-[#7a847a]">本月实时占比</p></div>{categoryTotals.some((item) => item.total > 0) ? <div className="space-y-5">{<MobileList items={categoryTotals.filter((item) => item.total > 0)} render={(item) => <div key={item.name} className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${item.color}20`, color: item.color }}><item.icon size={18} /></div><div className="flex-1"><div className="mb-1.5 flex justify-between text-sm"><span>{item.name}</span><span>{money(item.total)}</span></div><div className="h-1.5 rounded-full bg-[#edf0eb]"><div className="h-full rounded-full" style={{ width: `${totals.expense ? item.total / totals.expense * 100 : 0}%`, background: item.color }} /></div></div></div>}/>}</div> : <Empty compact onAdd={() => openEditor()} />}</div></MobileSections>
        </div></details>
        </MobileSections>}
        {view === "transactions" && <TransactionBrowser rows={rows} onEdit={openEditor} onAdd={() => openEditor()} onSync={() => { refreshRows().catch(() => setSyncState("error")); }} />}
        {view === "stats" && <StatsPanel rows={rows} categories={EXPENSE_CATEGORIES} budget={budget} />}
        {view === "accounts" && <AccountManager rows={rows} />}
        {view === "notes" && <NotesPanel />}
        {view === "wheels" && <WheelPanel />}
        {view === "life" && <LifePanel onLedgerChange={refreshRows} />}
        {view === "recurring" && <RecurringPanel onChange={refreshRows} />}

        {view === "trash" && <TrashPanel onRestore={refreshRows} />}
        {view === "settings" && <SettingsPanel user={user} budget={budget} onBudget={saveBudget} budgetError={budgetError} rows={rows} onLogout={logout} onTrash={() => navigate("trash")} categories={[...new Set([...EXPENSE_CATEGORIES.map((item) => item.name), ...INCOME_CATEGORIES])]} />}
      </div>
    </section>
    <nav className="ledger-bottom-nav fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t border-[#dfe5db] bg-white/95 px-3 backdrop-blur lg:hidden"><MobileNav icon={Home} label="首页" active={view === "overview"} onClick={() => navigate("overview")} /><MobileNav icon={BarChart3} label="统计" active={view === "stats"} onClick={() => navigate("stats")} /><button onClick={() => openEditor()} className="-mt-7 grid h-14 w-14 place-items-center rounded-full border-4 border-[#f4f6f1] bg-[#1e5b3a] text-white shadow-lg" aria-label="记一笔"><Plus /></button><MobileNav icon={WalletCards} label="明细" active={view === "transactions"} onClick={() => navigate("transactions")} /><MobileNav icon={FileText} label="记事" active={view === "notes"} onClick={() => navigate("notes")} /></nav>

    {dialog && <Editor draft={draft} setDraft={setDraft} editing={editingId !== null} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} onSubmit={submit} onClose={() => setDialog(false)} onDelete={removeCurrent} />}
  </main>;
}

function Editor({ draft, setDraft, editing, deleteConfirm, setDeleteConfirm, onSubmit, onClose, onDelete }: { draft: Draft; setDraft: (draft: Draft) => void; editing: boolean; deleteConfirm: boolean; setDeleteConfirm: (value: boolean) => void; onSubmit: (e: FormEvent, amount: number) => void; onClose: () => void; onDelete: () => void }) {
  const names = draft.type === "expense" ? EXPENSE_CATEGORIES.map((item) => item.name) : INCOME_CATEGORIES;
  const [amountInput, setAmountInput] = useState(draft.amount ? String(draft.amount) : "");
  const [amountError, setAmountError] = useState("");
  const calculated = parseMoneyExpression(amountInput);
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/25 backdrop-blur-sm sm:place-items-center sm:p-5" onMouseDown={onClose}><form onSubmit={(event) => { const amount = parseMoneyExpression(amountInput); if (amount === null) { event.preventDefault(); setAmountError("请输入有效金额或算式，结果须大于 0 元"); return; } onSubmit(event, amount); }} onMouseDown={(e) => e.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-[28px]"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{editing ? "编辑账目" : "记一笔"}</h2><button type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div><div className="mb-5 grid grid-cols-2 rounded-xl bg-[#f0f3ee] p-1">{(["expense", "income"] as const).map((type) => <button key={type} type="button" onClick={() => setDraft({ ...draft, type, category: type === "expense" ? "餐饮" : "工资" })} className={`rounded-lg py-2 text-sm ${draft.type === type ? "bg-white font-medium shadow-sm" : "text-[#7b857b]"}`}>{type === "expense" ? "支出" : "收入"}</button>)}</div><label className="mb-1 block text-xs text-[#778177]">金额</label><div className="mb-5 flex items-center border-b border-[#dfe5dc] pb-3"><span className="text-2xl">¥</span><input autoFocus inputMode="decimal" value={amountInput} onChange={(e) => { setAmountInput(e.target.value); setAmountError(""); }} className="min-w-0 flex-1 bg-transparent px-3 text-4xl font-semibold outline-none" placeholder="例如 12.50+3.20=" /></div><p className="-mt-4 mb-4 text-xs text-[#6c8d73]">{amountError || (calculated !== null && /[+*/×÷=]/.test(amountInput) ? `计算结果：${money(calculated)}` : "支持小数及 + − × ÷ 算式，例如 12.50+3.20=")}</p><label className="mb-2 block text-xs text-[#778177]">分类</label><div className="mb-5 grid grid-cols-4 gap-2">{names.map((name) => <button type="button" key={name} onClick={() => setDraft({ ...draft, category: name })} className={`rounded-xl border p-2 text-xs ${draft.category === name ? "border-[#6c9b77] bg-[#edf5ee]" : "border-[#e4e8e1]"}`}>{name}</button>)}</div><div className="mb-5 grid grid-cols-2 gap-3"><label className="text-xs text-[#778177]">账户<select value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dfe5dc] bg-white px-3 py-2.5 text-sm text-[#182018]">{ACCOUNTS.map((account) => <option key={account}>{account}</option>)}</select></label><label className="text-xs text-[#778177]">日期<input type="date" value={draft.occurredAt.slice(0, 10)} onChange={(e) => setDraft({ ...draft, occurredAt: `${e.target.value}T12:00:00.000Z` })} className="mt-2 w-full rounded-xl border border-[#dfe5dc] px-3 py-2 text-sm text-[#182018]" /></label></div><label className="mb-2 block text-xs text-[#778177]">备注</label><input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="mb-5 w-full rounded-xl border border-[#dfe5dc] px-4 py-3 text-sm outline-none focus:border-[#6c9b77]" placeholder="这笔钱花在哪里？" />{editing && deleteConfirm ? <div className="mb-3 flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-700"><span>移入回收站？之后可恢复。</span><button type="button" onClick={onDelete} className="font-semibold">移入回收站</button></div> : null}<div className="flex gap-3">{editing && <button type="button" onClick={() => setDeleteConfirm(!deleteConfirm)} className="grid h-12 w-12 place-items-center rounded-xl border border-red-200 text-red-600" aria-label="删除账目"><Trash2 size={18} /></button>}<button className="flex-1 rounded-xl bg-[#1e5b3a] py-3 font-medium text-white">{editing ? "保存修改" : "保存并同步"}</button></div></form></div>;
}

function StatsPanel({ rows: allRows, categories: definitions, budget }: { rows: Transaction[]; categories: Array<{ name: string; color: string }>; budget: number }) {
  const currentMonth = todayChina().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [statsModule, setStatsModule] = useState("summary");
  const rows = allRows.filter((r) => r.occurredAt.startsWith(month));
  const totals = rows.reduce((s, r) => { s[r.type] += r.amount; return s; }, { expense: 0, income: 0 });
  const categories = definitions.map((c) => ({ ...c, total: rows.filter((r) => r.type === "expense" && r.category === c.name).reduce((s, r) => s + r.amount, 0) })).sort((a, b) => b.total - a.total);
  const last = allRows.filter((r) => r.occurredAt.startsWith(shiftMonth(month, -1))).reduce((s, r) => { s[r.type] += r.amount; return s; }, { expense: 0, income: 0 });
  const comparison = (key: "expense" | "income") => { const diff = totals[key] - last[key]; return `较上月${diff >= 0 ? "增加" : "减少"} ¥${Math.abs(diff).toFixed(2)}${last[key] ? `（${(Math.abs(diff) / last[key] * 100).toFixed(1)}%）` : "（上月为零）"}`; };

  const balance = totals.income - totals.expense;
  const visible = categories.filter((item) => item.total > 0);
  let cursor = 0;
  const slices = visible.map((item) => { const start = cursor; cursor += totals.expense ? item.total / totals.expense * 100 : 0; return `${item.color} ${start}% ${cursor}%`; });
  const pie = slices.length ? `conic-gradient(${slices.join(",")})` : "#edf0eb";
  return <><div className="module-switch" role="group" aria-label="统计分析模块">{[{id:"summary",label:"收支统计"},{id:"spending",label:"支出分析"},{id:"budget",label:"分类预算"}].map(item => <button key={item.id} aria-pressed={statsModule === item.id} onClick={() => setStatsModule(item.id)}>{item.label}</button>)}</div><section className="stats-month-control surface-card flex flex-wrap items-center justify-between gap-4 rounded-[24px] border p-5"><div><h2 className="font-semibold">{statsModule === "summary" ? "历史收支统计" : statsModule === "spending" ? "支出分析" : "分类预算"}</h2><p className="mt-1 text-xs text-[#829078]">{month} · 自然月与上一自然月对比；本月未结束时为截至当前累计。</p></div><div className="flex items-center gap-3 text-sm"><button disabled={month <= "1970-01"} onClick={() => setMonth(shiftMonth(month, -1))}>上月</button><input aria-label="统计月份" type="month" min="1970-01" max={currentMonth} value={month} onChange={(e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} className="rounded-xl border p-2"/><button disabled={month >= currentMonth} onClick={() => setMonth(shiftMonth(month, 1))}>下月</button></div></section>{statsModule === "summary" && <div className="grid gap-4 sm:grid-cols-3"><Metric label="收入" value={money(totals.income)} change={comparison("income")} /><Metric label="支出" value={money(totals.expense)} change={comparison("expense")} tone="dark" /><Metric label="结余" value={money(balance)} change={balance >= 0 ? "所选月份有结余" : "支出超过收入"}/></div>}{statsModule === "spending" && <MobileSections labels={["支出构成", "分类排行"]} className="grid gap-6 lg:grid-cols-[.85fr_1.35fr]"><div className="surface-card rounded-[26px] border border-[#e0e5dd] bg-white p-6"><h2 className="font-semibold">支出构成</h2><p className="mb-6 text-xs text-[#7a847a]">所选月份分类占比</p><div className="relative mx-auto mb-7 aspect-square w-full max-w-[260px] rounded-full" style={{ background: pie }}><div className="absolute inset-[24%] grid place-items-center rounded-full bg-white text-center shadow-sm"><div><p className="text-xs text-[#879187]">总支出</p><p className="mt-1 text-lg font-semibold">{money(totals.expense)}</p></div></div></div>{visible.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-3">{visible.map((item) => <div key={item.name} className="flex min-w-0 items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }}/><span className="truncate">{item.name}</span><span className="ml-auto text-[#7c867c]">{Math.round(item.total / totals.expense * 100)}%</span></div>)}</div> : <p className="text-center text-sm text-[#8b948b]">暂无支出数据</p>}</div><div className="surface-card rounded-[26px] border border-[#e0e5dd] bg-white p-6"><h2 className="mb-1 font-semibold">分类排行榜</h2><p className="mb-6 text-xs text-[#7a847a]">所选月份各类支出及占比</p>{visible.length ? <div className="space-y-5">{<MobileList items={visible.map((item,index) => ({...item, rank: index+1}))} size={4} render={(item) => <div key={item.name} className="grid grid-cols-[28px_64px_1fr_auto] items-center gap-3 sm:grid-cols-[28px_80px_1fr_auto]"><span className="text-sm text-[#8b948b]">{item.rank}</span><span className="text-sm font-medium">{item.name}</span><div className="h-2 rounded-full bg-[#edf0eb]"><div className="h-full rounded-full" style={{ width: `${totals.expense ? item.total / totals.expense * 100 : 0}%`, background: item.color }}/></div><span className="text-sm">{money(item.total)}</span></div>}/>}</div> : <p className="py-12 text-center text-sm text-[#8b948b]">记录支出后会生成统计</p>}</div></MobileSections>}{statsModule === "budget" && <CategoryBudgetPanel rows={rows} month={month} totalBudget={budget}/>}</>;
}

function Brand() { return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1e5b3a] text-white"><WalletCards size={21} /></div><div><p className="font-semibold tracking-tight">青账</p><p className="text-xs text-[#738073]">让每笔钱有迹可循</p></div></div>; }
function Empty({ compact = false, onAdd }: { compact?: boolean; onAdd: () => void }) { return <div className={`grid place-items-center text-center ${compact ? "py-6" : "py-14"}`}><div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#edf3ed] text-[#578061]"><WalletCards size={19} /></div><p className="text-sm font-medium">还没有账目</p><button onClick={onAdd} className="mt-2 text-xs text-[#39704a]">记下第一笔</button></div></div>; }
function SyncLabel({ state }: { state: SyncState }) { const config = state === "synced" ? [RefreshCw, "已同步"] : state === "loading" || state === "pending" ? [RefreshCw, "同步中"] : state === "offline" ? [WifiOff, "离线待同步"] : [WifiOff, "同步失败，点此重试"]; const Icon = config[0] as typeof RefreshCw; return <span className="flex items-center gap-1 text-[11px] text-[#7b857b]"><Icon size={11} className={state === "pending" || state === "loading" ? "animate-spin" : ""} />{String(config[1])}</span>; }
function Nav({ icon: Icon, label, active = false, onClick }: { icon: typeof Home; label: string; active?: boolean; onClick: () => void }) { return <button onClick={onClick} aria-current={active ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "font-semibold" : ""}`}><Icon size={18} />{label}</button>; }
function MobileNav({ icon: Icon, label, active = false, onClick }: { icon: typeof Home; label: string; active?: boolean; onClick: () => void }) { return <button onClick={onClick} className={`grid place-items-center gap-0.5 text-[10px] ${active ? "text-[#1e5b3a]" : "text-[#7b857b]"}`}><Icon size={19} />{label}</button>; }
function Metric({ label, value, change, tone }: { label: string; value: string; change: string; tone?: "dark" }) { return <div className={`ledger-metric rounded-[24px] border p-5 ${tone === "dark" ? "ledger-metric-dark text-white" : "surface-card border-[#e0e5dd] bg-white"}`}><p className={`mb-5 text-sm ${tone === "dark" ? "text-white/70" : "text-[#6e796e]"}`}>{label}</p><p className="mb-3 text-2xl font-semibold tracking-tight">{value}</p><p className={`text-xs ${tone === "dark" ? "text-[#b6d4bd]" : "text-[#6c8d73]"}`}>{change}</p></div>; }
function money(value: number) { return `¥ ${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

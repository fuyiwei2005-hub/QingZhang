"use client";
import { money } from "../lib/format-money";
import { CategoryProvider, useCategories, categoryOptions } from "./category-context";
import { appPath } from "../lib/base-path";

import { Sparkles, BarChart3, CircleDot, CalendarDays, Eye, EyeOff, ArrowUpRight, Bus, Coffee, FileText, Film, Gift, GraduationCap, HeartPulse, Home, Landmark, LogOut, Menu, MoreHorizontal, Phone, Plus, RefreshCw, Settings, Shirt, ShoppingBag, Trash2, Utensils, WalletCards, WifiOff, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MobileList } from "./mobile-layout";
import Editor from "./transaction-editor";
import AiPanel from "./ai-panel";
import HomeShortcuts from "./home-shortcuts";
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
type View = "overview" | "transactions" | "stats" | "accounts" | "notes" | "settings" | "trash" | "recurring" | "wheels" | "life" | "anniversary" | "tools" | "profile";


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
function draftFor(row?: Transaction): Draft { return row ? { type: row.type, amount: row.amount, category: row.category, account: row.account, note: row.note, occurredAt: row.occurredAt } : { type: "expense", amount: 0, category: "餐饮", account: "微信", note: "", occurredAt: new Date().toISOString() }; }

export default function LedgerApp(props: {user:{name:string;email:string}}) { return <CategoryProvider key={props.user.email} userKey={props.user.email}><LedgerContent {...props}/></CategoryProvider>; }
function LedgerContent({ user }: { user: { name: string; email: string } }) {
  const custom = useCategories();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [dialog, setDialog] = useState(false);
  const [aiMode,setAiMode]=useState<"draft"|"query"|null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFor());
  const [mobileNav, setMobileNav] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const contentRef=useRef<HTMLDivElement>(null);
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
  const expenseDefinitions = useMemo(() => [...new Set([...custom.expenses,...rows.filter(r=>r.type==="expense").map(r=>r.category)])].map((name,i)=>EXPENSE_CATEGORIES.find(c=>c.name===name)||{name,icon:MoreHorizontal,color:["#64967a","#8a83b5","#c18a5c","#669bb0"][i%4]}), [custom.expenses,rows]);
  const budgetPercent = Math.min(100, Math.round(totals.expense / budget * 100));

  async function logout() { await fetch(appPath("/api/auth/logout"), { method: "POST" }); localStorage.removeItem(cacheKey); location.reload(); }
  function navigate(next: View) { setView(next); setMobileNav(false); contentRef.current?.scrollTo({top:0}); window.scrollTo({ top: 0 }); }

  function openEditor(row?: Transaction) { setEditingId(row?.id ?? null); setDraft(row ? draftFor(row) : {...draftFor(),category:categoryOptions(custom,"expense")[0],account:categoryOptions(custom,"account")[0]}); setDeleteConfirm(false); setDialog(true); }
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
      <nav className="max-h-[calc(100dvh-190px)] space-y-2 overflow-y-auto scrollbar-thin" aria-label="主导航"><Nav icon={Home} label="首页" active={view === "overview"} onClick={() => navigate("overview")} /><Nav icon={WalletCards} label="账目" active={view === "transactions"} onClick={() => navigate("transactions")} /><Nav icon={BarChart3} label="统计" active={view === "stats"} onClick={() => navigate("stats")} /><Nav icon={Landmark} label="账户" active={view === "accounts"} onClick={() => navigate("accounts")} /><Nav icon={CalendarDays} label="周期账单" active={view === "recurring"} onClick={() => navigate("recurring")} /><div className="my-4 border-t border-[#e3e9df]"/><Nav icon={Gift} label="生活工具" active={["tools","notes","life","wheels","anniversary"].includes(view)} onClick={() => navigate("tools")} /><Nav icon={Settings} label="我的" active={["profile","settings","trash"].includes(view)} onClick={() => navigate("profile")} /></nav>
      <div className="ledger-profile absolute bottom-5 left-5 right-5 rounded-2xl border p-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#dcecdf] font-semibold text-[#1e5b3a]">{user.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><SyncLabel state={syncState} /></div><button onClick={logout} aria-label="退出登录"><LogOut size={17} /></button></div></div>
    </aside>

    <section className="ledger-workspace lg:pl-64">
      <header className={`${view === "overview" ? "home-header " : ""}ledger-header sticky top-0 z-20 flex h-20 items-center justify-between border-b px-5 backdrop-blur-xl md:px-9`}><div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="打开菜单"><Menu /></button><div><p className="text-xs tracking-[.16em] text-[#788378]">{now.getFullYear()}年{now.getMonth() + 1}月<span className="hidden sm:inline"> · PERSONAL LEDGER</span></p><h1 className="text-lg font-semibold tracking-tight md:text-xl">{{ overview: "我的账本", tools: "生活工具", profile: "我的", transactions: "账目明细", stats: "统计分析", accounts: "账户管理", notes: "记事本", wheels: "转盘抽签", life: "生活工具", anniversary: "纪念倒数", recurring: "周期账单", trash: "回收站", settings: "设置" }[view]}</h1></div></div><div className="flex items-center gap-2">{view !== "overview" && view !== "settings" && view !== "notes" && view !== "trash" && view !== "recurring" && view !== "wheels" && view !== "life" && view !== "anniversary" && view !== "tools" && view !== "profile" && <button onClick={() => openEditor()} className="ledger-primary-button flex shrink-0 whitespace-nowrap h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white"><Plus size={18} />记一笔</button>}</div></header>
      <div ref={contentRef} className={`${view === "overview" ? "home-content " : ""}ledger-content mx-auto max-w-7xl space-y-6 p-5 md:p-9`}>
        {view === "overview" && <div className="home-dashboard space-y-5">
        <section className="home-summary surface-card">
          <div className="flex items-center justify-between gap-3"><p className="font-medium text-[#cb655e]">本月支出（元）</p><button onClick={() => navigate("accounts")} className="home-pill">账户 <ArrowUpRight size={14}/></button></div>
          <div className="my-4 flex min-w-0 items-center justify-between gap-2"><p className="home-amount tabular-nums">{hideAmounts ? "••••••" : money(totals.expense)}</p><button className="home-eye" onClick={() => setHideAmounts(!hideAmounts)} aria-label={hideAmounts ? "显示首页金额" : "隐藏首页金额"} aria-pressed={hideAmounts}>{hideAmounts ? <EyeOff size={22}/> : <Eye size={22}/>}</button></div>
          <div className="grid grid-cols-2 gap-4 border-b border-[#edf0eb] pb-6"><div><p className="text-xs text-[#849086]">本月收入</p><p className="mt-2 break-all text-lg font-semibold tabular-nums">{hideAmounts ? "••••" : money(totals.income)}</p></div><div><p className="text-xs text-[#849086]">本月结余</p><p className="mt-2 break-all text-lg font-semibold tabular-nums">{hideAmounts ? "••••" : money(totals.income - totals.expense)}</p></div></div>
          <button onClick={() => openEditor()} className="home-record"><Plus size={22}/>记一笔</button>
          <div className="mt-4 flex items-center justify-between text-xs text-[#859087]"><span>随手记账，心中有数</span><SyncLabel state={syncState}/></div>
        </section>
        <HomeShortcuts userKey={user.email} onNavigate={target => navigate(target as View)}/>
        <section className="surface-card rounded-[26px] border p-5 md:p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">本月预算</h2><button onClick={() => navigate("settings")} className="home-pill">修改预算 <ArrowUpRight size={14}/></button></div><div className="my-4 flex flex-wrap items-end justify-between gap-2"><div><p className="mb-1 text-xs text-[#849086]">{totals.expense > budget ? "已超出预算" : "剩余可用"}</p><p className="text-2xl font-semibold tabular-nums" style={{color: totals.expense > budget ? "#cb655e" : undefined}}>{hideAmounts ? "••••" : money(Math.abs(budget - totals.expense))}</p></div><p className="text-xs text-[#849086]">总预算 {hideAmounts ? "••••" : money(budget)}</p></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0eb]"><div className="h-full rounded-full bg-[#93bb98]" style={{width: `${budgetPercent}%`}}/></div>{budgetError && <p role="alert" className="mt-3 text-xs text-red-600">{budgetError}</p>}</section><button className="home-stat-link" onClick={() => navigate("stats")}>查看收支趋势与分类分析 <ArrowUpRight size={16}/></button></div>}
        {view === "tools" && <div className="hub-list">{[{target:"notes",title:"记事本",description:"随手记录与待办事项",icon:FileText},{target:"wheels",title:"转盘抽签",description:"让选择变得轻松一点",icon:CircleDot},{target:"anniversary",title:"纪念倒数",description:"记住每个重要的日子",icon:CalendarDays},{target:"life",title:"日常管理",description:"购物、订阅、目标、借还款与习惯",icon:Gift}].map(item=><button key={item.target} onClick={()=>navigate(item.target as View)}><span className="hub-icon"><item.icon size={22}/></span><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight size={18}/></button>)}</div>}
        {view === "profile" && <div className="space-y-5"><section className="profile-heading"><span>{user.name.slice(0,1)}</span><div><h2>{user.name}</h2><p>{user.email}</p><SyncLabel state={syncState}/></div></section><div className="hub-list">{[{target:"accounts",title:"账户管理",description:"余额、自定义账户与转账",icon:Landmark},{target:"tools",title:"生活工具",description:"记事、转盘、纪念日与日常管理",icon:Gift},{target:"settings",title:"设置",description:"预算、收支分类与数据导出",icon:Settings},{target:"trash",title:"回收站",description:"找回误删的账目和记录",icon:Trash2}].map(item=><button key={item.target} onClick={()=>navigate(item.target as View)}><span className="hub-icon"><item.icon size={22}/></span><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight size={18}/></button>)}</div></div>}
        {view === "transactions" && <TransactionBrowser rows={rows} onEdit={openEditor} onAdd={() => openEditor()} onSync={() => { refreshRows().catch(() => setSyncState("error")); }} />}
        {view === "stats" && <StatsPanel rows={rows} categories={expenseDefinitions} budget={budget} onAsk={()=>setAiMode("query")} />}
        {view === "accounts" && <AccountManager rows={rows} />}
        {view === "notes" && <NotesPanel />}
        {view === "wheels" && <WheelPanel />}
        {view === "life" && <LifePanel key="life" onLedgerChange={refreshRows} />}
        {view === "anniversary" && <LifePanel key="anniversary" anniversaryOnly onLedgerChange={refreshRows} />}
        {view === "recurring" && <RecurringPanel onChange={refreshRows} />}

        {view === "trash" && <TrashPanel onRestore={refreshRows} />}
        {view === "settings" && <SettingsPanel user={user} budget={budget} onBudget={saveBudget} budgetError={budgetError} rows={rows} onLogout={logout} onTrash={() => navigate("trash")} categories={[...new Set([...EXPENSE_CATEGORIES.map((item) => item.name), ...INCOME_CATEGORIES])]} />}
      </div>
    </section>
    <nav className="ledger-bottom-nav fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t border-[#dfe5db] bg-white/95 px-3 backdrop-blur lg:hidden"><MobileNav icon={Home} label="首页" active={view === "overview"} onClick={() => navigate("overview")} /><MobileNav icon={WalletCards} label="账目" active={view === "transactions"} onClick={() => navigate("transactions")} /><button onClick={() => openEditor()} className="-mt-7 grid h-14 w-14 place-items-center rounded-full border-4 border-[#f4f6f1] bg-[#1e5b3a] text-white shadow-lg" aria-label="记一笔"><Plus /></button><MobileNav icon={BarChart3} label="统计" active={view === "stats"} onClick={() => navigate("stats")} /><MobileNav icon={Settings} label="我的" active={["profile","settings","tools","notes","wheels","life","anniversary","accounts","trash","recurring"].includes(view)} onClick={() => navigate("profile")} /></nav>

    {aiMode && <AiPanel initialMode={aiMode} onClose={()=>setAiMode(null)} onChange={refreshRows}/>}
    {dialog && <Editor onAi={()=>{setDialog(false);setAiMode("draft");}} draft={draft} setDraft={setDraft} editing={editingId !== null} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} onSubmit={submit} onClose={() => setDialog(false)} onDelete={removeCurrent} />}
  </main>;
}

function StatsPanel({ rows: allRows, categories: definitions, budget,onAsk }: { rows: Transaction[]; categories: Array<{ name: string; color: string }>; budget: number;onAsk:()=>void }) {
  const currentMonth = todayChina().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [statsModule, setStatsModule] = useState("summary");
  const rows = allRows.filter((r) => r.occurredAt.startsWith(month));
  const totals = rows.reduce((s, r) => { s[r.type] += r.amount; return s; }, { expense: 0, income: 0 });
  const categories = definitions.map((c) => ({ ...c, total: rows.filter((r) => r.type === "expense" && r.category === c.name).reduce((s, r) => s + r.amount, 0) })).sort((a, b) => b.total - a.total);
  const last = allRows.filter((r) => r.occurredAt.startsWith(shiftMonth(month, -1))).reduce((s, r) => { s[r.type] += r.amount; return s; }, { expense: 0, income: 0 });
  const comparison = (key: "expense" | "income") => { const diff = totals[key] - last[key]; return `较上月${diff >= 0 ? "增加" : "减少"} ¥${Math.abs(diff).toFixed(2)}${last[key] ? `（${(Math.abs(diff) / last[key] * 100).toFixed(1)}%）` : "（上月为零）"}`; };

  const history=Array.from({length:6},(_,i)=>{const key=shiftMonth(month,i-5);const entries=allRows.filter(r=>r.occurredAt.startsWith(key));return {key,income:entries.filter(r=>r.type==="income").reduce((n,r)=>n+Math.round(r.amount*100),0)/100,expense:entries.filter(r=>r.type==="expense").reduce((n,r)=>n+Math.round(r.amount*100),0)/100};});
  const chartMax=Math.max(1,...history.flatMap(r=>[r.income,r.expense]));
  const balance = totals.income - totals.expense;
  const visible = categories.filter((item) => item.total > 0);
  let cursor = 0;
  const slices = visible.map((item) => { const start = cursor; cursor += totals.expense ? item.total / totals.expense * 100 : 0; return `${item.color} ${start}% ${cursor}%`; });
  const pie = slices.length ? `conic-gradient(${slices.join(",")})` : "#edf0eb";
  return <><button className="ai-entry" onClick={onAsk}><Sparkles size={16}/>问问账本 · 查询收支</button><div className="module-switch" role="group" aria-label="统计分析模块">{[{id:"summary",label:"收支趋势"},{id:"spending",label:"分类分析"},{id:"budget",label:"分类预算"}].map(item => <button key={item.id} aria-pressed={statsModule === item.id} onClick={() => setStatsModule(item.id)}>{item.label}</button>)}</div><section className="stats-month-control surface-card flex flex-wrap items-center justify-between gap-4 rounded-[24px] border p-5"><div><h2 className="font-semibold">{statsModule === "summary" ? "历史收支统计" : statsModule === "spending" ? "支出分析" : "分类预算"}</h2><p className="mt-1 text-xs text-[#829078]">{month} · 自然月与上一自然月对比；本月未结束时为截至当前累计。</p></div><div className="flex items-center gap-3 text-sm"><button disabled={month <= "1970-01"} onClick={() => setMonth(shiftMonth(month, -1))}>上月</button><input aria-label="统计月份" type="month" min="1970-01" max={currentMonth} value={month} onChange={(e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} className="rounded-xl border p-2"/><button disabled={month >= currentMonth} onClick={() => setMonth(shiftMonth(month, 1))}>下月</button></div></section>{statsModule === "summary" && <div className="grid gap-4 sm:grid-cols-3"><Metric label="收入" value={money(totals.income)} change={comparison("income")} /><Metric label="支出" value={money(totals.expense)} change={comparison("expense")} tone="dark" /><Metric label="结余" value={money(balance)} change={balance >= 0 ? "所选月份有结余" : "支出超过收入"}/></div>}{statsModule === "summary" && <section className="surface-card rounded-[24px] border p-5"><div className="flex justify-between gap-3 mb-4"><h2 className="text-sm font-semibold">近六个月收支</h2><span className="text-xs text-[#71826f]">绿色收入 · 橙色支出</span></div><div className="history-chart">{history.map(r=><div key={r.key}><div className="history-bars" role="img" aria-label={`${r.key} 收入${money(r.income)}，支出${money(r.expense)}`} title={`${r.key} 收入${money(r.income)}，支出${money(r.expense)}`}><span style={{height:`${Math.max(2,r.income/chartMax*100)}%`}}/><span style={{height:`${Math.max(2,r.expense/chartMax*100)}%`}}/></div><p>{r.key.slice(5)}月</p><small>+{money(r.income)}</small><small>−{money(r.expense)}</small></div>)}</div></section>}{statsModule === "spending" && <div className="stats-breakdown grid gap-6 lg:grid-cols-[.85fr_1.35fr]"><div className="surface-card rounded-[26px] border border-[#e0e5dd] bg-white p-6"><h2 className="font-semibold">支出构成</h2><p className="mb-6 text-xs text-[#7a847a]">所选月份分类占比</p><div className="relative mx-auto mb-7 aspect-square w-full max-w-[260px] rounded-full" style={{ background: pie }}><div className="absolute inset-[24%] grid place-items-center rounded-full bg-white text-center shadow-sm"><div><p className="text-xs text-[#879187]">总支出</p><p className="mt-1 text-lg font-semibold">{money(totals.expense)}</p></div></div></div>{visible.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-3">{visible.map((item) => <div key={item.name} className="flex min-w-0 items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }}/><span className="truncate">{item.name}</span><span className="ml-auto text-[#7c867c]">{Math.round(item.total / totals.expense * 100)}%</span></div>)}</div> : <p className="text-center text-sm text-[#8b948b]">暂无支出数据</p>}</div><div className="surface-card rounded-[26px] border border-[#e0e5dd] bg-white p-6"><h2 className="mb-1 font-semibold">分类排行榜</h2><p className="mb-6 text-xs text-[#7a847a]">所选月份各类支出及占比</p>{visible.length ? <div className="space-y-5">{<MobileList items={visible.map((item,index) => ({...item, rank: index+1}))} size={4} render={(item) => <div key={item.name} className="grid grid-cols-[28px_64px_1fr_auto] items-center gap-3 sm:grid-cols-[28px_80px_1fr_auto]"><span className="text-sm text-[#8b948b]">{item.rank}</span><span className="text-sm font-medium">{item.name}</span><div className="h-2 rounded-full bg-[#edf0eb]"><div className="h-full rounded-full" style={{ width: `${totals.expense ? item.total / totals.expense * 100 : 0}%`, background: item.color }}/></div><span className="text-sm">{money(item.total)}</span></div>}/>}</div> : <p className="py-12 text-center text-sm text-[#8b948b]">记录支出后会生成统计</p>}</div></div>}{statsModule === "budget" && <CategoryBudgetPanel rows={rows} month={month} totalBudget={budget}/>}</>;
}

function Brand() { return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1e5b3a] text-white"><WalletCards size={21} /></div><div><p className="font-semibold tracking-tight">青账</p><p className="text-xs text-[#738073]">让每笔钱有迹可循</p></div></div>; }
function Empty({ compact = false, onAdd }: { compact?: boolean; onAdd: () => void }) { return <div className={`grid place-items-center text-center ${compact ? "py-6" : "py-14"}`}><div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#edf3ed] text-[#578061]"><WalletCards size={19} /></div><p className="text-sm font-medium">还没有账目</p><button onClick={onAdd} className="mt-2 text-xs text-[#39704a]">记下第一笔</button></div></div>; }
function SyncLabel({ state }: { state: SyncState }) { const config = state === "synced" ? [RefreshCw, "已同步"] : state === "loading" || state === "pending" ? [RefreshCw, "同步中"] : state === "offline" ? [WifiOff, "离线待同步"] : [WifiOff, "同步失败，请到账目页重试"]; const Icon = config[0] as typeof RefreshCw; return <span className="flex items-center gap-1 text-[11px] text-[#7b857b]"><Icon size={11} className={state === "pending" || state === "loading" ? "animate-spin" : ""} />{String(config[1])}</span>; }
function Nav({ icon: Icon, label, active = false, onClick }: { icon: typeof Home; label: string; active?: boolean; onClick: () => void }) { return <button onClick={onClick} aria-current={active ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "font-semibold" : ""}`}><Icon size={18} />{label}</button>; }
function MobileNav({ icon: Icon, label, active = false, onClick }: { icon: typeof Home; label: string; active?: boolean; onClick: () => void }) { return <button onClick={onClick} aria-current={active ? "page" : undefined} className={`grid place-items-center gap-0.5 text-[10px] ${active ? "text-[#1e5b3a]" : "text-[#7b857b]"}`}><Icon size={19} />{label}</button>; }
function Metric({ label, value, change, tone }: { label: string; value: string; change: string; tone?: "dark" }) { return <div className={`ledger-metric rounded-[24px] border p-5 ${tone === "dark" ? "ledger-metric-dark text-white" : "surface-card border-[#e0e5dd] bg-white"}`}><p className={`mb-5 text-sm ${tone === "dark" ? "text-white/70" : "text-[#6e796e]"}`}>{label}</p><p className="mb-3 text-2xl font-semibold tracking-tight">{value}</p><p className={`text-xs ${tone === "dark" ? "text-[#b6d4bd]" : "text-[#6c8d73]"}`}>{change}</p></div>; }

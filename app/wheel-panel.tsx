"use client";
import { useEffect, useRef, useState } from "react";
import { CircleDot, Plus, Save, Trash2 } from "lucide-react";
import { api, card, field } from "../lib/client-api";
import { randomWheelIndex, wheelInput, type WheelInput } from "../lib/wheel";
import { MobileSections } from "./mobile-layout";
type Wheel = WheelInput & { id: number; updatedAt: string };
const colors = ["#d8ead6", "#f4e6c8", "#c9ddd9", "#efdad0", "#dce2bf", "#d6dff0"];
const blank = (): WheelInput => ({ title: "", options: ["", ""] });
export default function WheelPanel() {
  const [saved, setSaved] = useState<Wheel[]>([]);
  const [id, setId] = useState<number | null>(null);
  const [draft, setDraft] = useState<WheelInput>(blank);
  const [baseline, setBaseline] = useState(() => JSON.stringify(blank()));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = JSON.stringify(draft) !== baseline;
  const locked = busy || spinning;
  useEffect(() => {
    let alive = true;
    api<{ wheels: Wheel[] }>("/api/wheels").then(data => { if (alive) setSaved(data.wheels); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  // Warn when closing the tab with unsaved edits.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    if (dirty) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function load(wheel?: Wheel) {
    if (locked || (dirty && !window.confirm("当前转盘有未保存的修改，确定切换吗？"))) return;
    const next = wheel ? { title: wheel.title, options: [...wheel.options] } : blank();
    setId(wheel?.id ?? null); setDraft(next); setBaseline(JSON.stringify(next)); setRotation(0); setResult(""); setStatus(""); setError(""); setPage(0);
  }
  function edit(next: WheelInput) { setDraft(next); setResult(""); setRotation(0); setStatus(""); setError(""); }
  async function save() {
    if (locked) return;
    const input = wheelInput(draft);
    if (!input) { setError("请填写名称和全部选项，至少 2 项，每项最多 60 字。"); setPage(1); return; }
    setBusy(true); setError(""); setStatus("");
    try {
      const data = await api<{ wheel: Wheel }>(id ? `/api/wheels?id=${id}` : "/api/wheels", id ? "PUT" : "POST", input);
      setSaved(current => [data.wheel, ...current.filter(w => w.id !== data.wheel.id)]);
      setId(data.wheel.id); setDraft(input); setBaseline(JSON.stringify(input)); setStatus("转盘已保存，可切换或新建其他转盘");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!id || locked || !window.confirm("永久删除这个转盘？删除后无法恢复。")) return;
    setBusy(true); setError("");
    try {
      await api(`/api/wheels?id=${id}`, "DELETE"); setSaved(current => current.filter(w => w.id !== id));
      const next = blank(); setId(null); setDraft(next); setBaseline(JSON.stringify(next)); setRotation(0); setResult(""); setStatus("转盘已删除");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function spin() {
    if (locked) return;
    if (draft.options.length < 2 || draft.options.some(o => !o.trim())) { setError("请先填写至少两个完整选项"); setPage(1); return; }
    const selected = randomWheelIndex(draft.options.length);
    const target = (360 - (selected + .5) * 360 / draft.options.length) % 360;
    const next = rotation + 360 * 5 + (target - rotation % 360 + 360) % 360;
    setSpinning(true); setResult(""); setError(""); setRotation(next);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => { setResult(draft.options[selected].trim()); setSpinning(false); }, reduced ? 30 : 3600);
  }
  const count = draft.options.length;
  const gradient = `conic-gradient(${draft.options.map((_, i) => `${colors[i % colors.length]} ${i * 360 / count}deg ${(i + 1) * 360 / count}deg`).join(",")})`;
  return <div className="space-y-4">
    <section className={card}>
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">我的转盘</h2><p className="mt-1 text-xs text-[#819078]">把选择交给一点好运 · 每个选项等概率</p></div><button type="button" disabled={locked} onClick={() => load()} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm disabled:opacity-40"><Plus size={16}/>新建</button></div>
      <label className="mt-3 block text-xs text-[#70816e]">已保存的转盘<select aria-label="选择已保存转盘" disabled={locked || loading} className={field} value={id ?? ""} onChange={e => { if (!e.target.value) load(); else { const wheel = saved.find(w => w.id === Number(e.target.value)); if (wheel) load(wheel); } }}><option value="">{loading ? "正在加载…" : "新转盘（尚未保存）"}</option>{saved.map(w => <option key={w.id} value={w.id}>{w.title} · {w.options.length}项</option>)}</select></label>
    </section>
    <MobileSections labels={["转盘抽签", "编辑选项"]} active={page} onActive={setPage} className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} text-center`}>
        <h3 className="font-semibold">{draft.title.trim() || "今天选什么？"}</h3>
        <div className="wheel-stage" aria-label="抽签转盘">
          <div className="wheel-pointer" aria-hidden="true"/>
          <div className="wheel-disc" style={{ background: gradient, transform: `rotate(${rotation}deg)` }} aria-hidden="true">
            {draft.options.map((option, i) => { const angle = (i + .5) * 2 * Math.PI / count; return <span key={i} className="wheel-label" style={{ left: `${50 + 33 * Math.sin(angle)}%`, top: `${50 - 33 * Math.cos(angle)}%`, fontSize: count > 16 ? 10 : 12 }}>{option.trim().slice(0, 6) || `选项${i + 1}`}{option.trim().length > 6 ? "…" : ""}</span>; })}
          </div>
          <div className="wheel-center" aria-hidden="true"><CircleDot size={25}/></div>
        </div>
        <button type="button" onClick={spin} disabled={locked || loading} className="ledger-primary-button w-full rounded-xl py-3 text-white disabled:opacity-40">{spinning ? "好运转动中…" : "开始抽签"}</button>
        <p role="status" aria-live="polite" className="mt-3 break-words text-lg font-semibold text-[#245b3c]">{result ? `抽中了：${result}` : ""}</p>
        <p className="mt-2 text-xs text-[#819078]">可以重复抽签；修改选项后记得保存。</p>
      </section>
      <section className={card}>
        <label className="block text-sm font-medium">转盘名称<input aria-label="转盘名称" disabled={locked} maxLength={60} className={field} value={draft.title} placeholder="例如：今天吃什么" onChange={e => edit({ ...draft, title: e.target.value })}/></label>
        <div className="my-4 flex items-center justify-between"><h3 className="text-sm font-medium">抽签选项 · {count}/40</h3><button type="button" disabled={locked || count >= 40} className="text-sm text-[#34724a] disabled:opacity-40" onClick={() => edit({ ...draft, options: [...draft.options, ""] })}>＋ 添加选项</button></div>
        <div className="flex flex-col gap-2">{draft.options.map((option, i) => <div key={i} className="flex items-center gap-2"><span className="w-5 shrink-0 text-center text-xs text-[#85947e]">{i + 1}</span><input aria-label={`选项${i + 1}`} disabled={locked} maxLength={60} className={`${field} !mt-0 flex-1`} value={option} placeholder="填写抽签内容" onChange={e => edit({ ...draft, options: draft.options.map((v, index) => index === i ? e.target.value : v) })}/><button type="button" aria-label={`删除选项${i + 1}`} disabled={locked || count <= 2} onClick={() => edit({ ...draft, options: draft.options.filter((_, index) => index !== i) })} className="shrink-0 rounded-lg p-2 text-[#ae7762] disabled:opacity-30"><Trash2 size={17}/></button></div>)}</div>
      </section>
    </MobileSections>
    <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
      <div role="status" className={`min-w-0 text-sm ${error ? "text-red-700" : "text-[#698064]"}`}>{error || status || (dirty ? "有未保存的修改" : id ? "已保存到账号" : "保存后可在其他设备打开")}</div>
      <div className="flex items-center gap-3">{id && <button type="button" disabled={locked} onClick={remove} className="text-sm text-[#a66e59] disabled:opacity-40">删除转盘</button>}<button type="button" onClick={save} disabled={locked || loading || (!!id && !dirty)} className="ledger-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-white disabled:opacity-40"><Save size={16}/>{busy ? "处理中…" : "保存转盘"}</button></div>
    </section>
  </div>;
}

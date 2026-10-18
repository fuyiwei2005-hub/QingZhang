"use client";
import { MobileSections, MobileList } from "./mobile-layout";
import NoteExtras, { emptyMetadata, type NoteMetadata } from "./note-extras";
import { appPath } from "../lib/base-path";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search, Trash2 } from "lucide-react";

type Note = NoteMetadata & { id: number; title: string; content: string; createdAt: string; updatedAt: string };
type Draft = NoteMetadata & { title: string; content: string };

function shortDate(value: string) {
  const date = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

export default function NotesPanel() {
  const [mobilePage, setMobilePage] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", content: "", ...emptyMetadata });
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(appPath("/api/notes")).then(async (response) => {
      const data = await response.json() as { notes?: Note[]; error?: string };
      if (!response.ok) throw new Error(data.error || "笔记加载失败");
      setNotes(data.notes || []);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "笔记加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const selected = notes.find((note) => note.id === selectedId);
  const dirty = creating ? Boolean(draft.title || draft.content) : Boolean(selected && (draft.title !== selected.title || draft.content !== selected.content || draft.pinned !== selected.pinned || JSON.stringify(draft.tags) !== JSON.stringify(selected.tags) || JSON.stringify(draft.todos) !== JSON.stringify(selected.todos)));
  const filtered = useMemo(() => notes.filter((note) => `${note.title} ${note.content} ${note.tags.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (!tag || note.tags.includes(tag))).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [notes, query, tag]);
  function canLeave() { return !dirty || window.confirm("当前笔记尚未保存，确定离开吗？"); }
  function choose(note: Note) { if (!canLeave()) return; setMobilePage(1); setSelectedId(note.id); setDraft({ title: note.title, content: note.content, pinned: note.pinned, tags: note.tags, todos: note.todos }); setCreating(false); setConfirmDelete(false); setError(""); setMessage(""); }
  function create() { if (!canLeave()) return; setMobilePage(1); setSelectedId(null); setDraft({ title: "", content: "", ...emptyMetadata }); setCreating(true); setConfirmDelete(false); setError(""); setMessage(""); }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) { setError("请填写笔记标题"); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(appPath(selectedId ? `/api/notes?id=${selectedId}` : "/api/notes"), {
        method: selectedId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, tags: draft.tags.map((t) => t.trim()).filter(Boolean) }),
      });
      const data = await response.json() as { note?: Note; error?: string };
      if (!response.ok || !data.note) throw new Error(data.error || "保存失败，请稍后重试");
      const note = data.note;
      setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)]);
      setSelectedId(note.id); setDraft({ title: note.title, content: note.content, pinned: note.pinned, tags: note.tags, todos: note.todos }); setCreating(false); setMessage("已保存并同步到账号");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请稍后重试"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!selectedId) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(appPath(`/api/notes?id=${selectedId}`), { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "删除失败");
      setNotes((current) => current.filter((note) => note.id !== selectedId));
      setSelectedId(null); setDraft({ title: "", content: "", ...emptyMetadata }); setCreating(false); setConfirmDelete(false); setMessage("笔记已移入回收站");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); }
    finally { setSaving(false); }
  }

  return <MobileSections labels={["笔记列表", "编辑笔记"]} active={mobilePage} onActive={setMobilePage} className="notes-panel grid min-h-[620px] gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
    <div className="surface-card flex min-h-[260px] flex-col rounded-[26px] border bg-white p-5">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-medium tracking-[.16em] text-[#8b9c89]">YOUR NOTES</p><h2 className="mt-1 text-lg font-semibold">我的记事本</h2></div><span className="rounded-full bg-[#eaf1e7] px-2.5 py-1 text-xs text-[#557660]">{notes.length} 篇</span></div>
      <button onClick={create} className="ledger-primary-button mb-4 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white"><Plus size={18}/>新建笔记</button>
      <label className="mb-4 flex items-center gap-2 rounded-xl border border-[#e0e8dd] bg-[#f8faf7] px-3 text-[#79907a]"><Search size={16}/><input aria-label="搜索笔记" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或内容" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[#193027] outline-none"/></label>
      <label className="mb-4 text-xs text-[#839177]">按标签筛选<select value={tag} onChange={(e) => setTag(e.target.value)} className="mt-1 w-full rounded-xl border p-2 text-sm"><option value="">全部标签</option>{[...new Set(notes.flatMap((n) => n.tags))].map((t) => <option key={t}>{t}</option>)}</select></label>
      <div className="max-h-[570px] space-y-2 overflow-y-auto pr-1">{loading ? <p className="py-8 text-center text-sm text-[#879187]">正在加载笔记…</p> : filtered.length ? <MobileList items={filtered} size={2} render={(note) => <button key={note.id} onClick={() => choose(note)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedId === note.id ? "border-[#aac9af] bg-[#edf5eb]" : "border-transparent bg-[#f8faf7] hover:border-[#d8e5d7] hover:bg-[#f1f6ef]"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{note.pinned ? "📌 " : ""}{note.title}</span><span className="shrink-0 text-[11px] text-[#91a091]">{shortDate(note.updatedAt)}</span></div><p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-[#7a897b]">{note.content || "暂无正文"}</p><p className="mt-1 text-xs text-[#819376]">{note.tags.map((t) => `#${t}`).join(" ")}{note.todos.length ? ` · 待办 ${note.todos.filter((t) => t.done).length}/${note.todos.length}` : ""}</p></button>}/> : <div className="py-12 text-center text-sm text-[#879187]"><FileText className="mx-auto mb-3 text-[#9bb59d]" size={28}/>{query ? "没有找到相关笔记" : "还没有笔记，写下第一篇吧"}</div>}</div>
    </div>
    <div className="surface-card flex min-h-[500px] flex-col rounded-[26px] border bg-white p-5 md:p-8">
      {selected || creating ? <form onSubmit={save} className="flex flex-1 flex-col"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#879187]">{selected ? `创建于 ${shortDate(selected.createdAt)} · 更新于 ${shortDate(selected.updatedAt)}` : "新笔记 · 写下你想记住的事"}</p>{selected && <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm text-[#ae6a5b] hover:text-red-700"><Trash2 size={16}/>删除</button>}</div><input aria-label="笔记标题" maxLength={100} value={draft.title} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setMessage(""); }} placeholder="给这篇笔记取个标题" className="w-full border-b border-[#e5ebe1] pb-5 text-2xl font-semibold outline-none placeholder:text-[#a8b5a7] md:text-3xl"/><MobileSections labels={["正文", "标签待办"]} className="note-editor-pages"><div><textarea aria-label="笔记内容" maxLength={20000} value={draft.content} onChange={(event) => { setDraft({ ...draft, content: event.target.value }); setMessage(""); }} placeholder="从这里开始记录想法、计划或生活中的小事…" className="mt-6 min-h-[280px] w-full flex-1 resize-y bg-transparent text-sm leading-8 outline-none placeholder:text-[#a3b0a2]"/></div><NoteExtras key={selectedId ?? "new"} value={draft} onChange={(meta) => { setDraft({ ...draft, ...meta }); setMessage(""); }}/></MobileSections><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9eee6] pt-5"><div role="status" className={`text-xs ${error ? "text-red-700" : "text-[#758b78]"}`}>{error || message || (dirty ? "有未保存的修改" : "内容已保存")}</div><button disabled={saving || (!dirty && !creating)} className="ledger-primary-button rounded-xl px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "保存中…" : "保存笔记"}</button></div></form> : <div className="flex flex-1 flex-col items-center justify-center text-center"><div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[#eaf3e9] text-[#35724e]"><FileText size={30}/></div><h3 className="text-xl font-semibold">留一点空间，写给自己</h3><p className="mt-2 max-w-xs text-sm leading-6 text-[#849184]">记录待办、灵感和生活片段。笔记会保存在你的账号中。</p><button onClick={create} className="mt-6 rounded-xl border border-[#cbdcca] px-5 py-2.5 text-sm font-medium text-[#245b3c] hover:bg-[#f3f8f1]">写一篇笔记</button>{error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}</div>}
      {confirmDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5"><div role="dialog" aria-modal="true" aria-label="确认删除笔记" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold">将笔记移入回收站？</h3><p className="mt-2 text-sm text-[#7b887b]">可在回收站中恢复。</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirmDelete(false)} className="rounded-xl border px-4 py-2 text-sm">取消</button><button onClick={remove} disabled={saving} className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">移入回收站</button></div></div></div>}
    </div>
  </MobileSections>;
}

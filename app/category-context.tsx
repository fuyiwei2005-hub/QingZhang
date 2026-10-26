"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { expenses, incomes, accounts } from "../lib/ledger-domain";
import { api, field } from "../lib/client-api";
type Categories={accounts:string[];expenses:string[];incomes:string[]};
const Context=createContext<Categories & {error:string;add:(type:string,name:string)=>Promise<void>}>({expenses,incomes,accounts,error:"",add:async()=>{}});
export function CategoryProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState<Categories>({expenses,incomes,accounts});const [error,setError]=useState("");
 useEffect(()=>{let alive=true;const load=()=>api<Categories>("/api/categories").then(v=>{if(alive){setData(v);setError("")}}).catch(()=>{if(alive)setError("自定义分类暂未加载，请联网后重新打开页面")});void load();window.addEventListener("focus",load);window.addEventListener("online",load);return()=>{alive=false;window.removeEventListener("focus",load);window.removeEventListener("online",load)};},[]);
 async function add(type:string,name:string){const next=await api<Categories>("/api/categories","POST",{type,name});setData(next);setError("");}
 return <Context.Provider value={{...data,error,add}}>{children}</Context.Provider>;
}
export function useCategories(){return useContext(Context);}
export function CategorySettings(){
 const {expenses,incomes,error,add}=useCategories();const [type,setType]=useState("expense");const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 return <section className="surface-card rounded-[26px] border p-6"><h2 className="font-semibold">常驻收支分类</h2><p className="mt-2 text-xs text-[#7b8e79]">新增分类会永久保存在账号中，手机与电脑都可使用。</p><form className="my-4 flex flex-col gap-3" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage("");try{await add(type,name);setName("");setMessage("分类已保存，记账时可直接选择");}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}><label className="text-sm">收支类型<select disabled={busy} className={field} value={type} onChange={e=>setType(e.target.value)}><option value="expense">支出分类</option><option value="income">收入分类</option></select></label><label className="text-sm">分类名称<input required disabled={busy} maxLength={20} className={field} value={name} onChange={e=>setName(e.target.value)} placeholder="例如：宠物、育儿、副业"/></label><button disabled={busy||!name.trim()} className="ledger-primary-button rounded-xl px-4 py-3 text-sm text-white disabled:opacity-40">{busy?"保存中…":"添加常驻分类"}</button><p role="status" className="text-sm text-[#58765e]">{message||error}</p></form>{[{label:"支出分类",names:expenses},{label:"收入分类",names:incomes}].map(group=><div key={group.label} className="mt-4"><h3 className="mb-2 text-sm font-medium">{group.label}</h3><div className="flex flex-wrap gap-2">{group.names.map(n=><span key={n} className="max-w-full break-words rounded-xl bg-[#edf2eb] px-3 py-2 text-xs">{n}</span>)}</div></div>)}</section>;
}

export function AccountCreator({onCreated}:{onCreated?:(name:string)=>void}) {
 const {add}=useCategories();const [open,setOpen]=useState(false);const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function save(){setBusy(true);setError("");try{const value=name.trim();await add("account",value);onCreated?.(value);setName("");setOpen(false);}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="mb-4 rounded-xl border border-[#dfe7dc] p-3"><button type="button" disabled={busy} onClick={()=>setOpen(!open)} className="text-sm font-medium text-[#36734c]">{open?"收起":"＋ 添加自定义账户"}</button>{open&&<div className="mt-3"><label className="text-xs">账户名称<input aria-label="自定义账户名称" disabled={busy} maxLength={20} className={field} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(name.trim()&&!busy)void save();}}} placeholder="例如：招商银行卡、储蓄账户"/></label><p className="my-2 text-xs text-[#7b8e79]">保存后常驻，同一账号的手机与电脑均可使用。</p><button type="button" disabled={busy||!name.trim()} onClick={()=>void save()} className="rounded-lg bg-[#1e5b3a] px-4 py-2 text-sm text-white disabled:opacity-40">{busy?"保存中…":"保存账户"}</button>{error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>}</div>;
}

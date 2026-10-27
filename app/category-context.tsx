"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { expenses, incomes, accounts } from "../lib/ledger-domain";
import { api, field } from "../lib/client-api";
import { createCategoryRequestGate, isCategoryLists, type CategoryKind as Kind, type CategoryLists as Categories } from "../lib/category-options";
export { categoryOptions, availableCategoryValue } from "../lib/category-options";
const Context=createContext<Categories & {ready:boolean;manage:(type:Kind,order:string[],hidden:string[])=>Promise<void>;error:string;add:(type:string,name:string)=>Promise<void>}>({expenses,incomes,accounts,ready:false,manage:async()=>{},error:"",add:async()=>{}});
export function CategoryProvider({children,userKey}:{children:ReactNode;userKey:string}) {
 const [data,setData]=useState<Categories>({expenses,incomes,accounts});const [error,setError]=useState("");const [ready,setReady]=useState(false);
 const mounted=useRef(false);const requests=useRef(createCategoryRequestGate());
 const cacheKey=`qingzhang.categories.v1:${userKey}`;
 const accept=useCallback((next:Categories)=>{if(!isCategoryLists(next))throw new Error("分类数据格式无效，请刷新后重试");setData(next);setError("");setReady(true);try{localStorage.setItem(cacheKey,JSON.stringify(next));}catch{}},[cacheKey]);
 const load=useCallback(async()=>{const request=requests.current.read();if(request===null)return;try{const next=await api<Categories>("/api/categories");if(mounted.current&&requests.current.current(request))accept(next);}catch{if(mounted.current&&requests.current.current(request))setError("分类与账户暂未同步，联网后自动重试");}},[accept]);
 useEffect(()=>{mounted.current=true;setData({expenses,incomes,accounts});setReady(false);setError("");try{const cached:unknown=JSON.parse(localStorage.getItem(cacheKey)||"null");if(isCategoryLists(cached)){setData(cached);setReady(true);}}catch{}void load();const visible=()=>{if(!document.hidden)void load();};window.addEventListener("focus",load);window.addEventListener("online",load);document.addEventListener("visibilitychange",visible);return()=>{mounted.current=false;requests.current.invalidate();window.removeEventListener("focus",load);window.removeEventListener("online",load);document.removeEventListener("visibilitychange",visible);};},[load,cacheKey]);
 const write=useCallback(async(method:"POST"|"PATCH",body:unknown)=>{const request=requests.current.write();try{const next=await api<Categories>("/api/categories",method,body);if(mounted.current&&requests.current.current(request))accept(next);}finally{requests.current.finishWrite();}},[accept]);
 const add=useCallback((type:string,name:string)=>write("POST",{type,name}),[write]);
 const manage=useCallback((type:Kind,order:string[],hidden:string[])=>write("PATCH",{type,order,hidden}),[write]);
 const value=useMemo(()=>({...data,ready,error,add,manage}),[data,ready,error,add,manage]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCategories(){return useContext(Context);}
export function CategorySettings(){
 const data=useCategories();const [type,setType]=useState<Kind>("expense");const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const names=type==="account"?data.accounts:type==="income"?data.incomes:data.expenses;const hidden=data.hidden?.[type]||[];
 async function update(order:string[],nextHidden:string[]){setBusy(true);setMessage("");try{await data.manage(type,order,nextHidden);setMessage("设置已同步");}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 function move(index:number,delta:number){const order=[...names];[order[index],order[index+delta]]=[order[index+delta],order[index]];void update(order,hidden);}
 return <section className="surface-card rounded-[26px] border p-6"><h2 className="font-semibold">分类与账户</h2><p className="mt-2 text-xs leading-6 text-[#7b8e79]">排序与隐藏设置随账号同步。隐藏只影响新增时的选择，历史账目、统计和余额均保留。</p><div className="module-switch my-4">{(["expense","income","account"] as Kind[]).map(k=><button disabled={busy} key={k} aria-pressed={type===k} onClick={()=>setType(k)}>{k==="expense"?"支出":k==="income"?"收入":"账户"}</button>)}</div><form className="flex gap-2 mb-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await data.add(type,name);setName("");setMessage("已添加");}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}}><input aria-label="新增名称" required disabled={busy} maxLength={20} className={field} value={name} onChange={e=>setName(e.target.value)} placeholder="输入新名称"/><button disabled={busy||!name.trim()} className="shrink-0 rounded-xl px-4 text-sm bg-[#245b3c] text-white disabled:opacity-40">添加</button></form><p role="status" className="mb-2 text-xs text-[#58765e]">{message||data.error}</p><div className="preference-list">{names.map((n,i)=><div key={n}><span className={hidden.includes(n)?"text-[#93a18d]":""}>{n}{hidden.includes(n)&&<small> · 已隐藏</small>}</span><button disabled={busy||i===0} aria-label={`上移${n}`} onClick={()=>move(i,-1)}>↑</button><button disabled={busy||i===names.length-1} aria-label={`下移${n}`} onClick={()=>move(i,1)}>↓</button><button disabled={busy||(!hidden.includes(n)&&names.length-hidden.length<=1)} onClick={()=>void update(names,hidden.includes(n)?hidden.filter(v=>v!==n):[...hidden,n])}>{hidden.includes(n)?"显示":"隐藏"}</button></div>)}</div></section>;
}

export function AccountCreator({onCreated}:{onCreated?:(name:string)=>void}) {
 const {add}=useCategories();const [open,setOpen]=useState(false);const [name,setName]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function save(){setBusy(true);setError("");try{const value=name.trim();await add("account",value);onCreated?.(value);setName("");setOpen(false);}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="mb-4 rounded-xl border border-[#dfe7dc] p-3"><button type="button" disabled={busy} onClick={()=>setOpen(!open)} className="text-sm font-medium text-[#36734c]">{open?"收起":"＋ 添加自定义账户"}</button>{open&&<div className="mt-3"><label className="text-xs">账户名称<input aria-label="自定义账户名称" disabled={busy} maxLength={20} className={field} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(name.trim()&&!busy)void save();}}} placeholder="例如：招商银行卡、储蓄账户"/></label><p className="my-2 text-xs text-[#7b8e79]">保存后常驻，同一账号的手机与电脑均可使用。</p><button type="button" disabled={busy||!name.trim()} onClick={()=>void save()} className="rounded-lg bg-[#1e5b3a] px-4 py-2 text-sm text-white disabled:opacity-40">{busy?"保存中…":"保存账户"}</button>{error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>}</div>;
}

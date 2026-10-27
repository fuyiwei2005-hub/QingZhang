"use client";
import {useDialog} from "./use-dialog";
import {useEffect,useState,type FormEvent} from "react";
import {X,Sparkles,Trash2,ChevronDown,WalletCards} from "lucide-react";
import {useCategories,AccountCreator,categoryOptions,availableCategoryValue} from "./category-context";
import {parseMoneyExpression} from "../lib/money-expression";
import {money} from "../lib/format-money";
type Draft={type:"expense"|"income";amount:number;category:string;account:string;note:string;occurredAt:string};
type Props={onAi:()=>void;draft:Draft;setDraft:(draft:Draft)=>void;editing:boolean;deleteConfirm:boolean;setDeleteConfirm:(value:boolean)=>void;onSubmit:(e:FormEvent,amount:number)=>void;onClose:()=>void;onDelete:()=>void};
export default function TransactionEditor({onAi,draft,setDraft,editing,deleteConfirm,setDeleteConfirm,onSubmit,onClose,onDelete}:Props){
 const custom=useCategories();const names=categoryOptions(custom,draft.type,editing?draft.category:undefined);const accounts=categoryOptions(custom,"account",editing?draft.account:undefined);
 const [amount,setAmount]=useState(draft.amount?String(draft.amount):"");const [error,setError]=useState("");const [allCategories,setAllCategories]=useState(false);const [accountOpen,setAccountOpen]=useState(false);
 useEffect(()=>{if(editing||!custom.ready)return;const category=availableCategoryValue(custom,draft.type,draft.category),account=availableCategoryValue(custom,"account",draft.account);if(category!==draft.category||account!==draft.account)setDraft({...draft,category,account});},[custom,editing,draft,setDraft]);
 const calculated=parseMoneyExpression(amount);const visible=allCategories?names:[...new Set([...names.slice(0,8),...(names.includes(draft.category)?[draft.category]:[])])];
 function submit(e:FormEvent){if(!editing&&(!custom.ready||!names.includes(draft.category)||!accounts.includes(draft.account))){e.preventDefault();setError("分类与账户正在加载，请稍后再保存");return;}if(calculated===null){e.preventDefault();setError("请输入大于0的金额，也可以输入算式");return;}if(!draft.occurredAt.slice(0,10)){e.preventDefault();setError("请选择记账日期");return;}onSubmit(e,calculated);}
 const dialogRef=useDialog<HTMLFormElement>(onClose);
 return <div className="entry-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form ref={dialogRef} className="entry-dialog" role="dialog" aria-modal="true" aria-label={editing?"编辑账目":"记一笔"} onSubmit={submit}>
 <header className="entry-heading"><h2>{editing?"编辑账目":"记一笔"}</h2><div>{!editing&&<button type="button" className="entry-ai-link" onClick={onAi}><Sparkles size={15}/>AI 记账</button>}<button type="button" onClick={onClose} aria-label="关闭"><X size={21}/></button></div></header>
 <div className="entry-scroll"><div className="entry-type" role="group" aria-label="收支类型">{(["expense","income"] as const).map(type=><button type="button" key={type} aria-pressed={draft.type===type} onClick={()=>{setDraft({...draft,type,category:categoryOptions(custom,type)[0]});setAllCategories(false);}}>{type==="expense"?"支出":"收入"}</button>)}</div>
 <label className="entry-money-label" htmlFor="entry-amount">金额</label><div className="entry-money"><span>¥</span><input id="entry-amount" autoFocus inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setError("");}} placeholder="0.00" autoComplete="off"/></div>
 {error?<p className="entry-error" role="alert">{error}</p>:<p className="entry-money-hint">{calculated!==null&&/[+*/×÷=]/.test(amount)?`计算结果 ${money(calculated)}`:"可输入小数或算式，如 12.5 + 3.2"}</p>}
 {!editing&&!custom.ready&&<p role="status" className="entry-money-hint">{custom.error||"正在加载分类与账户…"}</p>}
 <div className="entry-section-title"><h3>分类</h3>{names.length>8&&<button type="button" aria-expanded={allCategories} onClick={()=>setAllCategories(!allCategories)}>{allCategories?"收起":"全部分类"}<ChevronDown size={13}/></button>}</div><div className="entry-categories">{visible.map(name=><button type="button" key={name} aria-pressed={draft.category===name} onClick={()=>setDraft({...draft,category:name})}>{name}</button>)}</div>
 <div className="entry-meta"><button type="button" className="entry-account" aria-expanded={accountOpen} aria-controls="entry-account-options" onClick={()=>setAccountOpen(!accountOpen)}><WalletCards size={16}/><span>{draft.account||"选择账户"}</span><ChevronDown size={13}/></button><label className="entry-date"><span className="sr-only">日期</span><input required type="date" aria-label="日期" value={draft.occurredAt.slice(0,10)} onChange={e=>setDraft({...draft,occurredAt:e.target.value?`${e.target.value}T12:00:00.000Z`:""})}/></label></div>
 {accountOpen&&<div id="entry-account-options" className="entry-account-panel"><p>选择账户</p><div className="entry-account-choices">{accounts.map(account=><button type="button" key={account} aria-pressed={draft.account===account} onClick={()=>{setDraft({...draft,account});setAccountOpen(false);}}>{account}</button>)}</div><AccountCreator onCreated={account=>{setDraft({...draft,account});setAccountOpen(false);}}/></div>}
 <label className="entry-note"><span>备注</span><input aria-label="备注" maxLength={120} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} placeholder="写点什么，方便以后查找"/></label>
 {editing&&deleteConfirm&&<div className="entry-delete-confirm"><span>移入回收站后可恢复</span><button type="button" onClick={onDelete}>确认移入</button></div>}
 </div><footer className="entry-footer">{editing&&<button type="button" className="entry-delete" aria-label="删除账目" onClick={()=>setDeleteConfirm(!deleteConfirm)}><Trash2 size={18}/></button>}<button className="entry-save" disabled={!editing&&!custom.ready}>{editing?"保存修改":"保存账目"}</button></footer>
 </form></div>;
}

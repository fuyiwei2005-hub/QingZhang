"use client";
import {useEffect,useState} from "react";
import {CalendarDays,Landmark,FileText,Gift,CircleDot,BarChart3} from "lucide-react";
const choices=[{target:"accounts",label:"账户",icon:Landmark},{target:"recurring",label:"周期账单",icon:CalendarDays},{target:"notes",label:"记事本",icon:FileText},{target:"tools",label:"全部工具",icon:Gift},{target:"wheels",label:"转盘抽签",icon:CircleDot},{target:"anniversary",label:"纪念倒数",icon:CalendarDays},{target:"stats",label:"统计分析",icon:BarChart3}];
const defaults=["accounts","recurring","notes","tools"];
export default function HomeShortcuts({userKey,onNavigate}:{userKey:string;onNavigate:(target:string)=>void}){
 const [selected,setSelected]=useState(defaults);const [editing,setEditing]=useState(false);const [error,setError]=useState("");
 const key=`qingzhang.shortcuts:${userKey}`;
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(key)||"null");if(Array.isArray(value)&&value.length===4&&new Set(value).size===4&&value.every(v=>choices.some(c=>c.target===v)))setSelected(value);}catch{}},[key]);
 function toggle(target:string){const next=selected.includes(target)?selected.filter(v=>v!==target):selected.length<4?[...selected,target]:selected;setSelected(next);setError("");}
 function save(){try{localStorage.setItem(key,JSON.stringify(selected));setEditing(false);}catch{setError("当前浏览器无法保存设置，请检查存储权限");}}
 return <section className="shortcut-section"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">常用入口</h2><button className="p-2 text-xs text-[#53785d]" onClick={()=>{setEditing(!editing);setError("");}}> {editing?"收起":"自定义"}</button></div><div className="home-shortcuts">{selected.map(target=>{const item=choices.find(c=>c.target===target)!;return <button key={target} onClick={()=>onNavigate(target)}><span><item.icon size={22}/></span>{item.label}</button>;})}</div>{editing&&<div className="shortcut-editor"><p className="mb-3 text-xs text-[#758575]">选择 4 个入口 · 仅保存在当前浏览器（{selected.length}/4）</p><div className="flex flex-wrap gap-2">{choices.map(item=><button key={item.target} aria-pressed={selected.includes(item.target)} disabled={!selected.includes(item.target)&&selected.length===4} onClick={()=>toggle(item.target)}>{item.label}</button>)}</div><button className="mt-3 text-sm text-[#1e5b3a] disabled:opacity-40" disabled={selected.length!==4} onClick={save}>保存入口</button>{error&&<p role="alert">{error}</p>}</div>}</section>;
}

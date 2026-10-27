import {validDate,validAmount,entryInput, type Entry} from "./ledger-domain";
import type {CategoryLists} from "./category-options";
export const AI_MAX_ROWS=30;
export type AiDraft={type:"expense"|"income"|"";amount:number|null;date:string;category:string;account:string;note:string;warning:string};
export type AiQuery={from:string;to:string;type:""|"income"|"expense";category:string;account:string;keyword:string};
export function parseDrafts(value:unknown,lists:CategoryLists):AiDraft[]{
 if(!Array.isArray(value)||!value.length||value.length>AI_MAX_ROWS)throw new Error("未识别出可用账目，或超过单次30笔限制，请分批识别");
 return value.map(raw=>{
  const r=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
  const type=r.type==="income"||r.type==="expense"?r.type:"";
  const category=typeof r.category==="string"&&(type==="income"?lists.incomes:lists.expenses).includes(r.category)?r.category:"";
  const account=typeof r.account==="string"&&lists.accounts.includes(r.account)?r.account:"";
  const warning=typeof r.warning==="string"?r.warning.slice(0,200):"";
  return {type,amount:validAmount(r.amount)?r.amount:null,date:validDate(r.date)?r.date:"",category,account,note:typeof r.note==="string"?r.note.slice(0,120):"",warning};
 });
}
export function parseQuery(value:unknown):AiQuery{
 const q=value as Record<string,unknown>|null;
 if(!q||!validDate(q.from)||!validDate(q.to)||q.from>q.to||!["","expense","income"].includes(String(q.type)))throw new Error("未明确查询日期或收支类型，请补充具体月份或日期范围");
 for(const k of ["category","account","keyword"])if(typeof q[k]!=="string"||(q[k] as string).length>120)throw new Error("查询条件无效，请换一种说法");
 return {from:q.from,to:q.to,type:q.type as AiQuery["type"],category:q.category as string,account:q.account as string,keyword:q.keyword as string};
}
export function confirmedEntry(value:unknown,lists:CategoryLists):Entry|null {return entryInput(value,lists);}
export function summarize(rows:Array<{type:string;amount:number;category:string}>) {
 let income=0,expense=0;const categories=new Map<string,number>();
 for(const r of rows){const cents=Math.round(r.amount*100);if(r.type==="income")income+=cents;else{expense+=cents;categories.set(r.category,(categories.get(r.category)||0)+cents);}}
 return {count:rows.length,income:income/100,expense:expense/100,balance:(income-expense)/100,categories:[...categories].map(([name,cents])=>({name,amount:cents/100})).sort((a,b)=>b.amount-a.amount)};
}
export async function boundedJson(request:Request,maxBytes:number):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new Error("请求为空");let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new Error("内容过大，请缩小图片或分批提交");}chunks.push(value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(all));
}
export function validImage(value:unknown):value is string {
 if(typeof value!=="string"||value.length>4_000_000)return false;
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)return false;
 try{const bytes=atob(match[2]);return match[1]==="png"?bytes.startsWith("\x89PNG\r\n\x1a\n"):match[1]==="jpeg"?bytes.startsWith("\xff\xd8\xff"):bytes.startsWith("RIFF")&&bytes.slice(8,12)==="WEBP";}catch{return false;}
}

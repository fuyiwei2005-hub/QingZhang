import { appPath } from "./base-path";
import {publicError} from "./user-errors";
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
 let response:Response;
 try{response=await fetch(appPath(path),{method,cache:"no-store",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new Error("连接中断，暂时无法确认操作结果，请检查网络后重试");}
 let data:T & {error?:string};
 try{data=await response.json() as typeof data;}catch{throw new Error(publicError(null,response.status>=400?response.status:502));}
 if(!response.ok)throw new Error(publicError(data?.error,response.status));
 return data;
}
export const field = "mt-1 w-full min-w-0 rounded-xl border border-[#dfe7dc] bg-[#fafcf9] px-3 py-2.5 text-sm";
export const card = "surface-card rounded-[26px] border p-5 md:p-6";

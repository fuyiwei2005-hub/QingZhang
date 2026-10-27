import { getAppUser } from "../../auth";
import { userCategories } from "../../../lib/user-categories";
import { customCategories } from "../../../db/schema";
import { getDb } from "../../../db";
export async function GET() {
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 return Response.json(await userCategories(user.id));
}
export async function POST(request: Request) {
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 const body=await request.json().catch(()=>null) as {type?:unknown;name?:unknown}|null;
 if(!body || !["expense","income","account"].includes(String(body.type)) || typeof body.name!=="string" || !body.name.trim() || body.name.trim().length>20 || /[\u0000-\u001f\u007f]/.test(body.name))return Response.json({error:"请选择分类类型，名称为 1～20 字"},{status:400});
 const name=body.name.trim();const type=body.type as "expense"|"income"|"account";
 const existing=await userCategories(user.id);
 if((type==="account"?existing.accounts:type==="expense"?existing.expenses:existing.incomes).includes(name))return Response.json({error:"该类型下已有同名分类"},{status:409});
 const [created]=await getDb().insert(customCategories).values({userId:user.id,type,name}).onConflictDoNothing().returning();
 if(!created)return Response.json({error:"分类已存在，请刷新"},{status:409});
 return Response.json(await userCategories(user.id),{status:201});
}

export async function PATCH(request: Request) {
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 const body=await request.json().catch(()=>null) as {type?:string;order?:unknown;hidden?:unknown}|null;
 if(!body||!["expense","income","account"].includes(body.type || "")||!Array.isArray(body.order)||!Array.isArray(body.hidden))return Response.json({error:"无效的分类设置"},{status:400});
 const type=body.type as "expense"|"income"|"account";
 const current=await userCategories(user.id);const names=type==="account"?current.accounts:type==="income"?current.incomes:current.expenses;
 const order=body.order as string[],hidden=body.hidden as string[];
 if(order.length!==names.length||new Set(order).size!==names.length||order.some(n=>!names.includes(n))||new Set(hidden).size!==hidden.length||hidden.some(n=>!names.includes(n))||hidden.length>=names.length)return Response.json({error:"请刷新列表，并至少保留一个可用选项"},{status:400});
 const db=getDb();const operations=order.map((name,position)=>db.insert(customCategories).values({userId:user.id,type,name,position,hidden:hidden.includes(name)}).onConflictDoUpdate({target:[customCategories.userId,customCategories.type,customCategories.name],set:{position,hidden:hidden.includes(name)}}));
 await db.batch(operations as [typeof operations[number],...typeof operations[number][]]);
 return Response.json(await userCategories(user.id));
}

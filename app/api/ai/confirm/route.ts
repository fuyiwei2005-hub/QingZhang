import {env} from "cloudflare:workers";
import {and,eq,sql} from "drizzle-orm";
import {getAppUser} from "../../../auth";
import {getDb} from "../../../../db";
import {aiRequests,transactions} from "../../../../db/schema";
import {boundedJson,confirmedEntry} from "../../../../lib/ai-domain";
import {userCategories} from "../../../../lib/user-categories";
export async function POST(request:Request){
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 let body:{id?:string;rows?:Array<{index:number;entry:unknown;confirmed:boolean}>};try{body=await boundedJson(request,50000) as typeof body;}catch{return Response.json({error:"请求格式无效"},{status:400});}
 if(!body||typeof body.id!=="string"||!Array.isArray(body.rows)||!body.rows.length||body.rows.length>30)return Response.json({error:"请选择1至30笔账目"},{status:400});
 const db=getDb();const [draft]=await db.select().from(aiRequests).where(and(eq(aiRequests.id,body.id),eq(aiRequests.userId,user.id)));
 if(!draft)return Response.json({error:"草稿不存在"},{status:404});
 if(draft.status==="saved")return Response.json({id:body.id,mode:"saved",count:await countSaved(user.id,body.id)});
 if(draft.status!=="ready"||Date.now()-new Date(draft.createdAt).getTime()>86400000)return Response.json({error:"草稿已过期或已处理，请重新识别"},{status:409});
 const result=draft.result as {rows?:unknown[]};const categories=await userCategories(user.id);const indexes=new Set<number>();
 const validated=body.rows.map(row=>{if(!row||row.confirmed!==true||!Number.isInteger(row.index)||row.index<0||row.index>=(result.rows?.length||0)||indexes.has(row.index))return null;indexes.add(row.index);const entry=confirmedEntry(row.entry,categories);return entry?{index:row.index,entry}:null;});
 if(validated.some(r=>!r))return Response.json({error:"请补全日期、金额、分类、账户，并逐条确认"},{status:400});
 const binding=env.DB!;
 const ops=validated.map(row=>{const {entry,index}=row!;return binding.prepare("INSERT OR IGNORE INTO transactions (user_id,type,amount,category,account,note,occurred_at,source_key) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM ai_requests WHERE id=? AND user_id=? AND status='ready')").bind(user.id,entry.type,entry.amount,entry.category,entry.account,entry.note,entry.date+"T12:00:00.000Z","ai:"+body.id+":"+index,body.id!,user.id);});
 const saved={id:body.id,mode:"saved",count:validated.length};
 const update=binding.prepare("UPDATE ai_requests SET status='saved',result=? WHERE id=? AND user_id=? AND status='ready'").bind(JSON.stringify(saved),body.id!,user.id);
 await binding.batch([...ops,update]);
 return Response.json({id:body.id,mode:"saved",count:await countSaved(user.id,body.id)});
}
async function countSaved(userId:string,id:string){const [r]=await getDb().select({n:sql<number>`count(*)`}).from(transactions).where(and(eq(transactions.userId,userId),sql`source_key LIKE ${"ai:"+id+":%"}`));return Number(r.n);}
export async function DELETE(request:Request){
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});const id=new URL(request.url).searchParams.get("id")||"";
 if(!/^[-a-zA-Z0-9]{20,80}$/.test(id))return Response.json({error:"无效批次"},{status:400});
 const db=getDb();const [saved]=await db.select().from(aiRequests).where(and(eq(aiRequests.id,id),eq(aiRequests.userId,user.id)));
 if(!saved||!["saved","undone"].includes(saved.status))return Response.json({error:"找不到已保存的批次"},{status:404});
 const result={id,mode:"undone"};await db.batch([db.update(transactions).set({deletedAt:new Date().toISOString()}).where(and(eq(transactions.userId,user.id),sql`source_key LIKE ${"ai:"+id+":%"}`,sql`deleted_at IS NULL`)),db.update(aiRequests).set({status:"undone",result}).where(and(eq(aiRequests.id,id),eq(aiRequests.userId,user.id)))]);
 return Response.json(result);
}

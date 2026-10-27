import {publicError} from "../../../lib/user-errors";
import {env} from "cloudflare:workers";
import {reserveAiRequest} from "../../../lib/ai-reservation";
import {and,eq,isNull,sql} from "drizzle-orm";
import {getAppUser} from "../../auth";
import {getDb} from "../../../db";
import {aiRequests,transactions} from "../../../db/schema";
import {aiConfig,askModel} from "../../../lib/ai-provider";
import {boundedJson,parseDrafts,parseQuery,summarize,validImage} from "../../../lib/ai-domain";
import {userCategories} from "../../../lib/user-categories";
import {categoryOptions} from "../../../lib/category-options";
import {todayChina} from "../../../lib/ledger-domain";
import {filterTransactions,emptyFilter} from "../../../lib/transaction-filter";
export async function GET(){
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 const c=aiConfig();const [usage]=await getDb().select({count:sql<number>`count(*)`}).from(aiRequests).where(and(eq(aiRequests.userId,user.id),eq(aiRequests.day,todayChina())));return Response.json({enabled:c.enabled,vision:!!c.visionModel,userLimit:c.userLimit,remaining:Math.max(0,c.userLimit-Number(usage.count)),maxRows:30});
}
export async function POST(request:Request){
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 let body:Record<string,unknown>;try{body=await boundedJson(request,4_100_000) as Record<string,unknown>;}catch{return Response.json({error:"请求过大或格式无效"},{status:400});}
 if(!body||typeof body!=="object"||body.consent!==true||!["draft","query"].includes(String(body.mode))||typeof body.text!=="string"||body.text.length>6000||(!body.text.trim()&&!body.image)||typeof body.id!=="string"||!/^[-a-zA-Z0-9]{20,80}$/.test(body.id)||body.image!==undefined&&!validImage(body.image)||body.mode==="query"&&!!body.image)return Response.json({error:"请检查文字、图片和数据处理授权"},{status:400});
 const config=aiConfig();if(!config.enabled)return Response.json({error:"AI 服务暂时不可用，请稍后再试"},{status:503});
 if(body.image&&!config.visionModel)return Response.json({error:"图片识别暂时不可用，请先使用文字记账"},{status:400});
 const db=getDb();await db.delete(aiRequests).where(sql`created_at < ${new Date(Date.now()-7*86400000).toISOString()}`);const [previous]=await db.select().from(aiRequests).where(and(eq(aiRequests.id,body.id),eq(aiRequests.userId,user.id)));
 if(previous){return previous.result?Response.json(previous.result):Response.json({error:"此请求正在处理或已失败，请稍后重新发起"},{status:409});}
 const day=todayChina(),now=new Date().toISOString(),activeSince=new Date(Date.now()-75000).toISOString();
 const reserved=await reserveAiRequest(env.DB!,{id:body.id,userId:user.id,day,now,activeSince,userLimit:config.userLimit,globalLimit:config.globalLimit});
 if(!reserved)return Response.json({error:"已达到今日调用限额，或有请求正在处理中，请稍后重试"},{status:429});
 try{
  const all=await userCategories(user.id);const options={expenses:categoryOptions(all,"expense"),incomes:categoryOptions(all,"income"),accounts:categoryOptions(all,"account")};
  const parsed=await askModel(body.mode as "draft"|"query",body.text,body.image as string|undefined,options);
  let result:unknown;
  if(body.mode==="draft"){
   const rows=parseDrafts(parsed.rows,options);
   const existing=await db.select({type:transactions.type,amount:transactions.amount,category:transactions.category,account:transactions.account,note:transactions.note,occurredAt:transactions.occurredAt}).from(transactions).where(eq(transactions.userId,user.id));
   const seen=new Set<string>();
   for(const row of rows){const key=JSON.stringify([row.type,row.amount,row.date,row.note]);const duplicate=seen.has(key)||existing.some(r=>r.type===row.type&&r.amount===row.amount&&r.occurredAt.startsWith(row.date)&&row.date&&r.note===row.note);if(duplicate)row.warning=`疑似重复，请核对。${row.warning}`;seen.add(key);}
   result={id:body.id,mode:"draft",rows};
  }else{
   const query=parseQuery(parsed.query);
   const entries=await db.select().from(transactions).where(and(eq(transactions.userId,user.id),isNull(transactions.deletedAt)));
   const matches=filterTransactions(entries,{...emptyFilter,...query,query:query.keyword});
   result={id:body.id,mode:"query",query,summary:summarize(matches),rows:matches.slice(0,100).map(r=>({id:r.id,type:r.type,amount:r.amount,category:r.category,account:r.account,note:r.note,date:r.occurredAt.slice(0,10)})),truncated:matches.length>100};
  }
  await db.update(aiRequests).set({status:body.mode==="draft"?"ready":"query",result}).where(and(eq(aiRequests.id,body.id),eq(aiRequests.userId,user.id)));
  return Response.json(result);
 }catch(error){await db.update(aiRequests).set({status:"failed"}).where(and(eq(aiRequests.id,body.id),eq(aiRequests.userId,user.id)));const message=error instanceof Error?error.message:"AI 请求失败";return Response.json({error:message.includes("timeout")||message.includes("aborted")?"AI 请求超时，本次没有写入账目，请重试":publicError(message,502)},{status:502});}
}

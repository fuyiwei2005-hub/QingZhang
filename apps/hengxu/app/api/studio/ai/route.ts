import {and,eq,sql} from "drizzle-orm";
import {env} from "cloudflare:workers";
import {getAppUser} from "../../../auth";
import {getDb} from "../../../../db";
import {aiRequests} from "../../../../db/schema";
import {studioData} from "../../../../lib/studio-store";
import {aiConfig,askModel} from "../../../../lib/ai-provider";
import {reserveAiRequest} from "../../../../lib/ai-reservation";
import {boundedJson,parseDrafts,validImage,confirmedEntry} from "../../../../lib/ai-domain";
import {studioLists,stagePaid,id} from "../../../../lib/studio-domain";
import {todayChina} from "../../../../lib/ledger-domain";
import {askStudioQuery} from "../../../../lib/studio-ai-query";
import {publicError} from "../../../../lib/user-errors";
export async function POST(request:Request){
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 try{
 const body=await boundedJson(request,4100000) as Record<string,unknown>;if(!body||body.consent!==true||!["draft","query","confirm"].includes(String(body.mode)))throw new Error("请同意数据处理说明并选择操作");
 const requestId=id(body.id),db=getDb(),data=await studioData(user.id);
 const [existing]=await db.select().from(aiRequests).where(and(eq(aiRequests.id,requestId),eq(aiRequests.userId,user.id)));
 if(body.mode==="confirm"){
  if(!existing)return Response.json({error:"草稿不存在"},{status:404});
  if(existing.status==="studio_saved")return Response.json(existing.result);
  if(existing.status!=="studio_ready"||Date.now()-new Date(existing.createdAt).getTime()>86400000)throw new Error("草稿已过期或已处理，请重新识别");
  if(!Array.isArray(body.rows)||!body.rows.length||body.rows.length>30)throw new Error("请选择1至30笔账目");
  const projectId=body.projectId?id(body.projectId):null,stageId=projectId&&body.stageId?id(body.stageId):null;
  if(projectId&&!data.projects.some(p=>p.id===projectId))throw new Error("项目不存在");
  const original=existing.result as {kind?:string;rows?:unknown[]};if(original.kind!=="studio")throw new Error("草稿类型无效");
  const seen=new Set<number>();const rows=body.rows.map((raw:Record<string,unknown>)=>{const index=Number(raw.index);if(raw.confirmed!==true||!Number.isInteger(index)||index<0||index>=(original.rows?.length||0)||seen.has(index))throw new Error("请逐条核对账目");seen.add(index);const entry=confirmedEntry(raw,studioLists);if(!entry||entry.date>todayChina())throw new Error("请补全有效金额、实际收支日期、分类和账户");return {...entry,index};});
  const incoming=rows.filter(r=>r.type==="income").reduce((n,r)=>n+Math.round(r.amount*100),0);
  if(projectId&&incoming>0&&!data.stages.some(s=>s.id===stageId&&s.projectId===projectId))throw new Error("请选择该项目的回款分期");
  const binding=env.DB!;
  const gate=binding.prepare("UPDATE ai_requests SET status='studio_saving' WHERE id=? AND user_id=? AND status='studio_ready' AND (? = 0 OR ? IS NULL OR ? <= (SELECT amount_cents-(SELECT COALESCE(sum(amount_cents),0) FROM studio_entries WHERE stage_id=? AND user_id=? AND type='income' AND deleted_at IS NULL) FROM studio_stages WHERE id=? AND project_id=? AND user_id=?))").bind(requestId,user.id,incoming,projectId,incoming,stageId,user.id,stageId,projectId,user.id);
  const ops=rows.map(r=>binding.prepare("INSERT OR IGNORE INTO studio_entries (id,user_id,project_id,stage_id,type,amount_cents,date,category,account,note,source_key) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM ai_requests WHERE id=? AND user_id=? AND status='studio_saving')").bind(`${requestId}-e${r.index}`,user.id,projectId,r.type==="income"?stageId:null,r.type,Math.round(r.amount*100),r.date,r.category,r.account,r.note,`studio-ai:${requestId}:${r.index}`,requestId,user.id));
  const result={kind:"studio",mode:"saved",id:requestId,count:rows.length};
  const finish=binding.prepare("UPDATE ai_requests SET status='studio_saved',result=? WHERE id=? AND user_id=? AND status='studio_saving'").bind(JSON.stringify(result),requestId,user.id);
  const output=await binding.batch([gate,...ops,finish]);
  if(!output[0].meta.changes){const [again]=await db.select().from(aiRequests).where(and(eq(aiRequests.id,requestId),eq(aiRequests.userId,user.id)));if(again?.status==="studio_saved")return Response.json(again.result);throw new Error("本期剩余应收不足，请刷新后核对金额");}
  return Response.json(result);
 }
 if(existing)return existing.status.startsWith("studio_")&&existing.result?Response.json(existing.result):Response.json({error:"请求已处理，请重新发起"},{status:409});
 if(typeof body.text!=="string"||body.text.length>6000||(!body.text.trim()&&!body.image)||body.image!==undefined&&!validImage(body.image)||body.mode==="query"&&body.image)throw new Error("请检查文字或图片内容");
 const config=aiConfig();if(!config.enabled)return Response.json({error:"AI服务暂不可用，请稍后再试"},{status:503});
 const projectId=body.projectId?id(body.projectId):undefined;if(projectId&&!data.projects.some(p=>p.id===projectId))throw new Error("项目不存在");
 const now=new Date().toISOString();const reserved=await reserveAiRequest(env.DB!,{id:requestId,userId:user.id,day:todayChina(),now,activeSince:new Date(Date.now()-75000).toISOString(),userLimit:config.userLimit,globalLimit:config.globalLimit});if(!reserved)return Response.json({error:"今日使用次数已用完，或上一条请求仍在处理中"},{status:429});
 try{
  const result=body.mode==="draft"?{kind:"studio",mode:"draft",id:requestId,rows:parseDrafts((await askModel("draft",body.text,body.image as string|undefined,studioLists)).rows,studioLists)}:{...await askStudioQuery(body.text,data,projectId),id:requestId};
  await db.update(aiRequests).set({status:body.mode==="draft"?"studio_ready":"studio_query",result}).where(and(eq(aiRequests.id,requestId),eq(aiRequests.userId,user.id)));return Response.json(result);
 }catch(error){await db.update(aiRequests).set({status:"failed"}).where(and(eq(aiRequests.id,requestId),eq(aiRequests.userId,user.id)));throw error;}
 }catch(error){return Response.json({error:publicError(error instanceof Error?error.message:"",400)},{status:400});}
}

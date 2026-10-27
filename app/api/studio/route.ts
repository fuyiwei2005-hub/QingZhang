import {and,eq} from "drizzle-orm";
import {env} from "cloudflare:workers";
import {getAppUser} from "../../auth";
import {getDb} from "../../../db";
import {studioClients,studioProjects,studioStages,studioEntries,studioTasks} from "../../../db/studio-schema";
import {studioData} from "../../../lib/studio-store";
import {boundedJson} from "../../../lib/ai-domain";
import {cents,date,id,text,studioLists} from "../../../lib/studio-domain";
import {todayChina} from "../../../lib/ledger-domain";
import {publicError} from "../../../lib/user-errors";
export async function GET(){const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});return Response.json(await studioData(user.id),{headers:{"Cache-Control":"no-store"}});}
export async function POST(request:Request){return mutate(request);}
export async function PATCH(request:Request){return mutate(request);}
async function mutate(request:Request){
 const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});
 try{
 const body=await boundedJson(request,100000) as Record<string,unknown>;if(!body||typeof body!=="object")throw new Error("请检查填写内容");
 const db=getDb(),data=await studioData(user.id),binding=env.DB!;const editing=request.method==="PATCH";const rowId=id(body.id||crypto.randomUUID());const op=body.op;
 const project=(value:unknown)=>{const key=id(value);const p=data.projects.find(r=>r.id===key);if(!p)throw new Error("项目不存在或不可访问");return p;};
 if(op==="client"){
  const values={name:text(body.name,60,true),contact:text(body.contact??"",120),note:text(body.note??"",500)};
  if(editing){if(!data.clients.some(c=>c.id===rowId))return Response.json({error:"客户不存在"},{status:404});await db.update(studioClients).set(values).where(and(eq(studioClients.id,rowId),eq(studioClients.userId,user.id)));}
  else{if(data.clients.some(c=>c.id===rowId))return Response.json(data);await db.insert(studioClients).values({id:rowId,userId:user.id,...values});}
 }else if(op==="project"){
  const clientId=body.clientId?id(body.clientId):null;if(clientId&&!data.clients.some(c=>c.id===clientId))throw new Error("请选择你自己的客户");
  const values={title:text(body.title,80,true),description:text(body.description??"",1000),contractCents:cents(body.contractAmount),dueDate:date(body.dueDate),clientId};
  if(editing){const p=project(rowId);const planned=data.stages.filter(s=>s.projectId===p.id).reduce((n,s)=>n+s.amountCents,0);if(values.contractCents<planned)throw new Error("约定金额不能小于已安排的分期合计，请先调整分期");
   const status=body.status??p.status;if(!["active","delivered","archived"].includes(String(status)))throw new Error("项目状态无效");
   const result=await binding.prepare("UPDATE studio_projects SET title=?,description=?,contract_cents=?,due_date=?,client_id=?,status=? WHERE id=? AND user_id=? AND ? >= (SELECT COALESCE(sum(amount_cents),0) FROM studio_stages WHERE project_id=? AND user_id=?)").bind(values.title,values.description,values.contractCents,values.dueDate,clientId,String(status),p.id,user.id,values.contractCents,p.id,user.id).run();if(!result.meta.changes)throw new Error("分期已更新，请刷新后重试");
  }else{
   if(data.projects.some(p=>p.id===rowId))return Response.json(data);
   const input=body.stages as Array<Record<string,unknown>>|undefined;
   if(!Array.isArray(input)||!input.length||input.length>12)throw new Error("请安排1至12期回款");
   const stages=input.map((s,i)=>({id:`${rowId}-s${i}`,userId:user.id,projectId:rowId,title:text(s.title,40,true),amountCents:cents(s.amount),dueDate:date(s.dueDate)}));
   if(stages.reduce((n,s)=>n+s.amountCents,0)>values.contractCents)throw new Error("分期合计不能超过项目约定金额");
   const firstTask=body.taskTitle?text(body.taskTitle,120,true):"";
   const ops=[db.insert(studioProjects).values({id:rowId,userId:user.id,...values}),...stages.map(s=>db.insert(studioStages).values(s))];
   if(firstTask)await db.batch([ops[0],...ops.slice(1),db.insert(studioTasks).values({id:rowId+"-t0",userId:user.id,projectId:rowId,title:firstTask,dueDate:values.dueDate})]);else await db.batch([ops[0],...ops.slice(1)]);
  }
 }else if(op==="stage"){
  const p=project(body.projectId),amount=cents(body.amount),title=text(body.title,40,true),dueDate=date(body.dueDate);
  if(editing){if(!data.stages.some(s=>s.id===rowId&&s.projectId===p.id))throw new Error("分期不存在");
   const result=await binding.prepare("UPDATE studio_stages SET title=?,amount_cents=?,due_date=? WHERE id=? AND user_id=? AND ? >= (SELECT COALESCE(sum(amount_cents),0) FROM studio_entries WHERE stage_id=? AND user_id=? AND type='income' AND deleted_at IS NULL) AND ? + (SELECT COALESCE(sum(amount_cents),0) FROM studio_stages WHERE project_id=? AND user_id=? AND id<>?) <= (SELECT contract_cents FROM studio_projects WHERE id=? AND user_id=?)").bind(title,amount,dueDate,rowId,user.id,amount,rowId,user.id,amount,p.id,user.id,rowId,p.id,user.id).run();if(!result.meta.changes)throw new Error("分期金额不能少于已收款，也不能超过项目剩余额度");
  }else{
   const result=await binding.prepare("INSERT OR IGNORE INTO studio_stages (id,user_id,project_id,title,amount_cents,due_date) SELECT ?,?,?,?,?,? WHERE ? + (SELECT COALESCE(sum(amount_cents),0) FROM studio_stages WHERE project_id=? AND user_id=?) <= (SELECT contract_cents FROM studio_projects WHERE id=? AND user_id=?)").bind(rowId,user.id,p.id,title,amount,dueDate,amount,p.id,user.id,p.id,user.id).run();if(!result.meta.changes&&!data.stages.some(s=>s.id===rowId))throw new Error("分期合计不能超过项目约定金额");
  }
 }else if(op==="entry"||op==="restore"){
  const old=data.entries.find(e=>e.id===rowId);if(editing&&!old)return Response.json({error:"收支记录不存在"},{status:404});
  const raw=op==="restore"&&old?{...old,amount:old.amountCents/100}:body;
  const type=raw.type;if(type!=="income"&&type!=="expense")throw new Error("请选择收入或支出");
  const amount=cents(raw.amount),when=date(raw.date,true)!;if(when>todayChina())throw new Error("实际收支不能使用未来日期，请在到账后再登记");
  const category=text(raw.category,30,true),account=text(raw.account,30,true),note=text(raw.note??"",200);
  if(!(type==="income"?studioLists.incomes:studioLists.expenses).includes(category)||!studioLists.accounts.includes(account))throw new Error("请选择有效分类与账户");
  const projectId=raw.projectId?project(raw.projectId).id:null;
  const stageId=type==="income"&&projectId?id(raw.stageId):null;
  if(stageId&&!data.stages.some(s=>s.id===stageId&&s.projectId===projectId))throw new Error("请选择该项目的回款分期");
  if(editing){const result=await binding.prepare("UPDATE studio_entries SET type=?,amount_cents=?,date=?,category=?,account=?,note=?,project_id=?,stage_id=?,deleted_at=NULL WHERE id=? AND user_id=? AND (? IS NULL OR ? <= (SELECT amount_cents - (SELECT COALESCE(sum(amount_cents),0) FROM studio_entries WHERE stage_id=? AND type='income' AND deleted_at IS NULL AND id<>? AND user_id=?) FROM studio_stages WHERE id=? AND user_id=? AND project_id=?))").bind(type,amount,when,category,account,note,projectId,stageId,rowId,user.id,stageId,amount,stageId,rowId,user.id,stageId,user.id,projectId).run();if(!result.meta.changes)throw new Error("本期剩余应收不足，请刷新后核对金额");
  }else{
   const result=await binding.prepare("INSERT OR IGNORE INTO studio_entries (id,user_id,project_id,stage_id,type,amount_cents,date,category,account,note) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (? IS NULL OR ? <= (SELECT amount_cents - (SELECT COALESCE(sum(amount_cents),0) FROM studio_entries WHERE stage_id=? AND type='income' AND deleted_at IS NULL AND user_id=?) FROM studio_stages WHERE id=? AND user_id=? AND project_id=?))").bind(rowId,user.id,projectId,stageId,type,amount,when,category,account,note,stageId,amount,stageId,user.id,stageId,user.id,projectId).run();if(!result.meta.changes&&!data.entries.some(e=>e.id===rowId))throw new Error("本期剩余应收不足，请刷新后核对金额");
  }
 }else if(op==="deleteEntry"){
  if(!data.entries.some(e=>e.id===rowId))return Response.json({error:"收支记录不存在"},{status:404});await db.update(studioEntries).set({deletedAt:new Date().toISOString()}).where(and(eq(studioEntries.id,rowId),eq(studioEntries.userId,user.id)));
 }else if(op==="task"){
  if(editing){if(typeof body.done!=="boolean"||!data.tasks.some(t=>t.id===rowId))throw new Error("待办不存在");await db.update(studioTasks).set({done:body.done}).where(and(eq(studioTasks.id,rowId),eq(studioTasks.userId,user.id)));}
  else{const p=project(body.projectId);await db.insert(studioTasks).values({id:rowId,userId:user.id,projectId:p.id,title:text(body.title,120,true),dueDate:date(body.dueDate)}).onConflictDoNothing();}
 }else throw new Error("暂不支持此操作");
 return Response.json(await studioData(user.id));
 }catch(error){const message=error instanceof Error?error.message:"保存失败";return Response.json({error:publicError(message,400)},{status:400});}
}

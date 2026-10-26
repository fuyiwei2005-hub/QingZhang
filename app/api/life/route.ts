import { and, desc, eq, like, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { lifeItems, lifeEvents, transactions } from "../../../db/schema";
import { getAppUser } from "../../auth";
import { lifeInput, nextBill, type LifeItem } from "../../../lib/life";
import { entryInput, todayChina, validAmount, validDate } from "../../../lib/ledger-domain";
const fail = (error: string, status = 400) => Response.json({error}, {status});
export async function GET() {
 const user = await getAppUser(); if (!user) return fail("请先登录",401);
 const db = getDb();
 const [items, events, purchases] = await Promise.all([
  db.select().from(lifeItems).where(eq(lifeItems.userId,user.id)).orderBy(desc(lifeItems.id)),
  db.select().from(lifeEvents).where(eq(lifeEvents.userId,user.id)).orderBy(desc(lifeEvents.date),desc(lifeEvents.id)),
  db.select({id:transactions.id,sourceKey:transactions.sourceKey,amount:transactions.amount,deletedAt:transactions.deletedAt}).from(transactions).where(and(eq(transactions.userId,user.id),like(transactions.sourceKey,"shopping:%"))),
 ]);
 return Response.json({items,events,purchases});
}
export async function POST(request: Request) {
 const user = await getAppUser(); if (!user) return fail("请先登录",401);
 const input = lifeInput.safeParse(await request.json().catch(()=>null));
 if (!input.success) return fail("请核对必填内容、日期和金额（最多两位小数）");
 const [item] = await getDb().insert(lifeItems).values({userId:user.id,kind:input.data.kind,data:input.data}).returning();
 return Response.json({item},{status:201});
}
export async function PUT(request: Request) {
 const user = await getAppUser(); if (!user) return fail("请先登录",401);
 const body = await request.json().catch(()=>null) as {id:number;version:number;data:unknown}|null; const input = lifeInput.safeParse(body?.data);
 if (!body || !input.success || !Number.isSafeInteger(body.id) || !Number.isSafeInteger(body?.version)) return fail("内容无效");
 // Debt principal may only be changed before repayments, avoiding invalid remaining balances.
 const db = getDb(); const [existing] = await db.select().from(lifeItems).where(and(eq(lifeItems.id,body.id),eq(lifeItems.userId,user.id)));
 if (!existing) return fail("记录不存在",404);
 if (existing.kind !== input.data.kind) return fail("不能修改模块类型");
 if ((existing.data.kind === "debt" && input.data.kind === "debt" && (existing.data.amount !== input.data.amount || existing.data.direction !== input.data.direction)) || (existing.data.kind === "subscription" && input.data.kind === "subscription" && (existing.data.date !== input.data.date || existing.data.frequency !== input.data.frequency))) {
  return fail("本金、借贷方向和缴费周期创建后不可更改，请新建记录");
 }
 const [item] = await db.update(lifeItems).set({data:input.data,version:sql`${lifeItems.version}+1`}).where(and(eq(lifeItems.id,body.id),eq(lifeItems.userId,user.id),eq(lifeItems.version,body.version))).returning();
 return item ? Response.json({item}) : fail("其他设备已修改这条记录，请刷新后重试",409);
}
export async function DELETE(request: Request) {
 const user = await getAppUser(); if (!user) return fail("请先登录",401);
 const id = Number(new URL(request.url).searchParams.get("id"));
 if (!Number.isSafeInteger(id) || id<1) return fail("记录无效");
 const [item] = await getDb().delete(lifeItems).where(and(eq(lifeItems.id,id),eq(lifeItems.userId,user.id))).returning();
 return item ? Response.json({ok:true}) : fail("记录不存在",404);
}
export async function PATCH(request: Request) {
 const user = await getAppUser(); if (!user) return fail("请先登录",401);
 const body = await request.json().catch(()=>null) as {id:number;action:string;eventId:number;date:string;key:string;amount:number;note:string}|null;
 if (!body || !Number.isSafeInteger(body.id)) return fail("记录无效");
 const db = getDb(); const [item] = await db.select().from(lifeItems).where(and(eq(lifeItems.id,body.id),eq(lifeItems.userId,user.id)));
 if (!item) return fail("记录不存在",404);
 if (body.action === "purchase" && item.kind === "shopping") {
  const input = entryInput({...body,type:"expense",note:item.data.title});
  if (!input) return fail("请确认实际金额、账户、分类和购买日期");
  const key = `shopping:${item.id}`;
  await env.DB!.batch([
   env.DB!.prepare("INSERT OR IGNORE INTO transactions(user_id,type,amount,category,account,note,occurred_at,source_key) SELECT ?,'expense',?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM life_items WHERE id=? AND user_id=?)").bind(user.id,input.amount,input.category,input.account,input.note,`${input.date}T12:00:00+08:00`,key,item.id,user.id),
   env.DB!.prepare("UPDATE life_items SET data=json_set(data,'$.done',json('true')),version=version+1 WHERE id=? AND user_id=?").bind(item.id,user.id),
  ]);
  return Response.json({ok:true});
 }
 if (body.action === "removeEvent" && Number.isSafeInteger(body.eventId)) {
  const [event] = await db.delete(lifeEvents).where(and(eq(lifeEvents.id,body.eventId),eq(lifeEvents.itemId,item.id),eq(lifeEvents.userId,user.id))).returning();
  return event ? Response.json({ok:true}) : fail("记录不存在",404);
 }
 if (body.action !== "event" || !validDate(body.date) || body.date > todayChina()) return fail("请选择今天或以前的有效日期");
 if (!["habit","goal","debt","subscription"].includes(item.kind)) return fail("不支持该操作");
 let amount = 0; let key = `${item.id}:${body.key}`;
 if (item.kind === "habit") {
  if (item.data.kind !== "habit" || !item.data.active) return fail("该习惯已暂停");
  key = `habit:${item.id}:${body.date}`;
 } else if (item.data.kind === "subscription") {
  if (!item.data.active) return fail("订阅已暂停");
  const events = await db.select().from(lifeEvents).where(eq(lifeEvents.itemId,item.id));
  key = `bill:${item.id}:${body.date}`;
  if (events.some(e=>e.eventKey===key)) return Response.json({ok:true});
  if (nextBill(item as LifeItem,events) !== body.date) return fail("缴费日期已更新，请刷新");
  amount = item.data.amount;
 } else {
  if (!validAmount(body.amount) || typeof body.key !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(body.key)) return fail("请输入正数金额（最多两位小数）");
  amount = body.amount;
 }
 const note = typeof body.note === "string" ? body.note.slice(0,200) : "";
 // Single SQL statement makes remaining-principal validation atomic with insertion.
 await env.DB!.prepare("INSERT OR IGNORE INTO life_events(user_id,item_id,date,amount,note,event_key) SELECT ?,?,?,?,?,? FROM life_items WHERE id=? AND user_id=? AND (kind!='debt' OR ROUND(?*100) <= ROUND(json_extract(data,'$.amount')*100)-COALESCE((SELECT SUM(ROUND(amount*100)) FROM life_events WHERE item_id=?),0))").bind(user.id,item.id,body.date,amount,note,key,item.id,user.id,amount,item.id).run();
 const [event] = await db.select().from(lifeEvents).where(and(eq(lifeEvents.userId,user.id),eq(lifeEvents.eventKey,key)));
 return event ? Response.json({event}) : fail("归还金额超过剩余欠款，请刷新后核对",409);
}

import { env } from "cloudflare:workers";
import { getAppUser } from "../../../auth";

export async function GET(request: Request) {
  const user=await getAppUser();
  if(!user)return Response.json({error:"请先登录"},{status:401});
  const query=new URL(request.url).searchParams;
  const cursor=query.get("before"), entity=query.get("entity") || "";
  if(cursor && (!/^\d+$/.test(cursor)||!Number.isSafeInteger(Number(cursor))||Number(cursor)<1) ||
    entity && !["client","project","stage","entry","task"].includes(entity))return Response.json({error:"筛选条件无效"},{status:400});
  try {
    const result=await env.DB!.prepare("SELECT id,entity,record_id AS recordId,action,before_json AS beforeJson,after_json AS afterJson,created_at AS createdAt FROM studio_activity WHERE user_id=? AND (?='' OR entity=?) AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT 51")
      .bind(user.id,entity,entity,cursor?Number(cursor):null,cursor?Number(cursor):null).all<{id:number;entity:string;recordId:string;action:string;beforeJson:string|null;afterJson:string;createdAt:string}>();
    const rows=result.results.slice(0,50).map(({beforeJson,afterJson,...row})=>({...row,before:beforeJson?JSON.parse(beforeJson):null,after:JSON.parse(afterJson)}));
    return Response.json({rows,next:result.results.length>50?rows[rows.length-1].id:null},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({error:"暂时无法加载修改记录，请稍后重试"},{status:503});
  }
}

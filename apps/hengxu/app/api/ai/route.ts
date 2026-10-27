import {and,eq,sql} from "drizzle-orm";
import {getAppUser} from "../../auth";
import {getDb} from "../../../db";
import {aiRequests} from "../../../db/schema";
import {aiConfig} from "../../../lib/ai-provider";
import {todayChina} from "../../../lib/ledger-domain";
export async function GET(){const user=await getAppUser();if(!user)return Response.json({error:"请先登录"},{status:401});const c=aiConfig();const [usage]=await getDb().select({count:sql<number>`count(*)`}).from(aiRequests).where(and(eq(aiRequests.userId,user.id),eq(aiRequests.day,todayChina())));return Response.json({enabled:c.enabled,vision:!!c.visionModel,userLimit:c.userLimit,remaining:Math.max(0,c.userLimit-Number(usage.count)),maxRows:30});}

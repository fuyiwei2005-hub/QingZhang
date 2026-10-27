// One SQLite statement reserves both the daily quota and the concurrency slot.
export async function reserveAiRequest(db:D1Database,input:{id:string;userId:string;day:string;now:string;activeSince:string;userLimit:number;globalLimit:number}){
 const q="INSERT OR IGNORE INTO ai_requests (id,user_id,day,status,created_at) SELECT ?,?,?,'processing',? WHERE (SELECT count(*) FROM ai_requests WHERE user_id=? AND day=?) < ? AND (SELECT count(*) FROM ai_requests WHERE day=?) < ? AND (SELECT count(*) FROM ai_requests WHERE user_id=? AND status='processing' AND created_at>?) = 0 AND (SELECT count(*) FROM ai_requests WHERE status='processing' AND created_at>?) < 3";
 const result=await db.prepare(q).bind(input.id,input.userId,input.day,input.now,input.userId,input.day,input.userLimit,input.day,input.globalLimit,input.userId,input.activeSince,input.activeSince).run();return !!result.meta.changes;
}

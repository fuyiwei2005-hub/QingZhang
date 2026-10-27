import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { customCategories } from "../db/schema";
import { expenses, incomes, accounts } from "./ledger-domain";
export async function userCategories(userId: string) {
 const rows=await getDb().select().from(customCategories).where(eq(customCategories.userId,userId)).orderBy(customCategories.id);
 const groups={expense:expenses,income:incomes,account:accounts};
 const list=(type:keyof typeof groups)=>[...new Set([...groups[type],...rows.filter(r=>r.type===type).map(r=>r.name)])].sort((a,b)=>(rows.find(r=>r.type===type&&r.name===a)?.position??1000)-(rows.find(r=>r.type===type&&r.name===b)?.position??1000));
 return {expenses:list("expense"),incomes:list("income"),accounts:list("account"),hidden:{expense:rows.filter(r=>r.type==="expense"&&r.hidden).map(r=>r.name),income:rows.filter(r=>r.type==="income"&&r.hidden).map(r=>r.name),account:rows.filter(r=>r.type==="account"&&r.hidden).map(r=>r.name)}};
}

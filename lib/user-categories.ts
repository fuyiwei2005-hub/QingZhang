import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { customCategories } from "../db/schema";
import { expenses, incomes } from "./ledger-domain";
export async function userCategories(userId: string) {
 const rows=await getDb().select().from(customCategories).where(eq(customCategories.userId,userId)).orderBy(customCategories.id);
 return {expenses:[...expenses,...rows.filter(r=>r.type==="expense").map(r=>r.name)],incomes:[...incomes,...rows.filter(r=>r.type==="income").map(r=>r.name)]};
}

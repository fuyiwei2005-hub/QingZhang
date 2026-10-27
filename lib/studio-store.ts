import {eq} from "drizzle-orm";
import {getDb} from "../db";
import {studioClients,studioProjects,studioStages,studioEntries,studioTasks} from "../db/studio-schema";
export async function studioData(userId:string){const db=getDb();const [clients,projects,stages,entries,tasks]=await Promise.all([db.select().from(studioClients).where(eq(studioClients.userId,userId)),db.select().from(studioProjects).where(eq(studioProjects.userId,userId)),db.select().from(studioStages).where(eq(studioStages.userId,userId)),db.select().from(studioEntries).where(eq(studioEntries.userId,userId)),db.select().from(studioTasks).where(eq(studioTasks.userId,userId))]);return {clients,projects,stages,entries,tasks};}

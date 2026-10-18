import { getAppUser } from "./auth";
import AuthScreen from "./auth-screen";
import LedgerApp from "./ledger-app";
export const dynamic = "force-dynamic";
export default async function Home() { const user = await getAppUser(); return user ? <LedgerApp user={{ name: user.name, email: user.email }} /> : <AuthScreen />; }

import {getAppUser} from "./auth";
import StudioApp from "./studio/studio-app";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getAppUser();return <StudioApp user={user?{name:user.name,email:user.email}:null}/>;}

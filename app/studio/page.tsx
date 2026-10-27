import {getAppUser} from "../auth";
import StudioApp from "./studio-app";
export const dynamic="force-dynamic";
export default async function Studio(){const user=await getAppUser();return <StudioApp user={user?{name:user.name,email:user.email}:null}/>;}

import {appPath} from "../../../lib/base-path";
export function GET(){return Response.json({name:"青账 Studio",short_name:"青账经营",start_url:appPath("/studio"),scope:appPath("/studio"),display:"standalone",background_color:"#f6f7f2",theme_color:"#153b31",icons:[{src:appPath("/studio-mark.svg"),sizes:"any",type:"image/svg+xml",purpose:"any"}]},{headers:{"Content-Type":"application/manifest+json"}});}

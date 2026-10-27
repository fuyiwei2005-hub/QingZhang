import {appPath} from "../../../lib/base-path";
export function GET(){return Response.json({name:"衡序 · 商务工作台",short_name:"衡序",start_url:appPath("/studio"),scope:appPath("/studio"),display:"standalone",background_color:"#f6f7f2",theme_color:"#153b31",icons:[{src:appPath("/studio-mark.svg"),sizes:"any",type:"image/svg+xml",purpose:"any"}]},{headers:{"Content-Type":"application/manifest+json"}});}

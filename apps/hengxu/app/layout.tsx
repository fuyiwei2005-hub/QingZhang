import type {Metadata} from "next";
import {appPath} from "../lib/base-path";
import "./globals.css";
import "./studio/studio.css";
import "./studio/studio-visual.css";
export const metadata:Metadata={title:"衡序 HENGXU｜商务经营工作台",description:"项目收支、分期回款与AI经营助手。",manifest:appPath("/manifest.webmanifest"),icons:{icon:appPath("/studio-mark.svg")},appleWebApp:{capable:true,title:"衡序"}};
export const viewport={width:"device-width",initialScale:1,themeColor:"#153b31"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}

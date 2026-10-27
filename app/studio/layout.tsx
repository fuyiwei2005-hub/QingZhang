import type {Metadata} from "next";
import {appPath} from "../../lib/base-path";
import "./studio.css";
import "./studio-visual.css";
export const metadata:Metadata={title:"衡序 HENGXU｜商务经营工作台",description:"面向自由职业者与学生创业团队的项目收支、分期回款与AI经营助手。",manifest:appPath("/studio/manifest.webmanifest"),icons:{icon:appPath("/studio-mark.svg")}};
export default function Layout({children}:{children:React.ReactNode}){return children;}

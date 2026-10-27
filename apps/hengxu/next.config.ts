import type {NextConfig} from "next";
const basePath=process.env.HENGXU_BASE_PATH||"";
const config:NextConfig={...(basePath?{basePath}:{}),env:{NEXT_PUBLIC_BASE_PATH:basePath}};
export default config;

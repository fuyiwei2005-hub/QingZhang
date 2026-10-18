import type { NextConfig } from "next";

const basePath = process.env.QINGZHANG_BASE_PATH || "";
const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

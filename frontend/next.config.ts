import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许引用项目根目录（AI-Calendar）下的 backend/ 共享代码
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;

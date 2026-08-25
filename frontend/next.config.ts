import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许引用项目根目录（AI-Calendar）下的 backend/ 共享代码
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // standalone：构建产物自包含运行所需依赖，便于"云端构建 + 服务器只运行"
  output: "standalone",
};

export default nextConfig;

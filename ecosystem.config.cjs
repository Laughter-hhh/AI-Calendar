// pm2 进程配置（CI 云端构建 + 服务器只运行 模式）
// 运行目录：/opt/ai-calendar/app（CI 每次部署会把构建产物解压到这里）
// 数据库：/opt/ai-calendar/database/data（在 app 目录之外，更新代码不会丢数据）
module.exports = {
  apps: [
    {
      name: "ai-calendar",
      cwd: "/opt/ai-calendar/app",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
        TZ: "Asia/Shanghai",
        DATABASE_PATH: "/opt/ai-calendar/database/data/ai-calendar.db",
      },
    },
  ],
};

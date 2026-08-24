#!/usr/bin/env bash
# ============================================================
# AI Calendar 一键部署脚本（Ubuntu 22.04 / 24.04）
#
# 用法（在服务器上执行，需要 root/sudo）：
#   sudo bash server-setup.sh <Git仓库地址> [分支名]
#
# 示例：
#   sudo bash server-setup.sh https://github.com/你的账号/AI-Calendar.git main
#
# 脚本会完成：装 Node.js → 装 pnpm/pm2 → 拉代码 → 构建 →
# 用 pm2 启动服务 → 放行端口。数据保存在 /opt/ai-calendar/database/data
# ============================================================
set -euo pipefail

REPO_URL="${1:?请提供 Git 仓库地址，例如 https://github.com/xxx/AI-Calendar.git}"
BRANCH="${2:-main}"
APP_DIR="/opt/ai-calendar"
PORT="${PORT:-3000}"

# Node 版本要求：22.13+（22.13 起内置 SQLite 无需额外参数）
NODE_VERSION="${NODE_VERSION:-v24.0.0}"
NODE_DIR="/usr/local/lib/nodejs"
# 国内服务器默认走国内镜像；海外服务器（如 Google Cloud）可这样加速：
#   NODE_MIRROR=https://nodejs.org/dist NPM_MIRROR=https://registry.npmjs.org sudo bash server-setup.sh ...
NODE_MIRROR="${NODE_MIRROR:-https://npmmirror.com/mirrors/node}"
NPM_MIRROR="${NPM_MIRROR:-https://registry.npmmirror.com}"

log()  { echo -e "\033[32m[部署]\033[0m $*"; }
warn() { echo -e "\033[33m[注意]\033[0m $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 sudo 运行本脚本：sudo bash server-setup.sh <仓库地址>"
  exit 1
fi

# ---------- 0. 基础依赖 + 低配机器开 swap ----------
log "安装基础依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get -o DPkg::Lock::Timeout=600 update -y
apt-get -o DPkg::Lock::Timeout=600 install -y curl ca-certificates xz-utils git build-essential

MEM_MB=$(free -m | awk '/Mem:/{print $2}')
if [ ! -f /swapfile ] && [ "$MEM_MB" -lt 2048 ]; then
  log "检测到内存较小（${MEM_MB}MB），创建 1G swap 防止构建时内存不足..."
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 1. Node.js ----------
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
  NODE_MINOR=$(node -p 'Number(process.versions.node.split(".")[1])')
  if [ "$NODE_MAJOR" -gt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 13 ]; }; then
    log "检测到已有满足要求的 Node.js：$(node -v)"
  else
    echo "检测到 Node 版本过低（$(node -v)），需要 22.13+。请卸载旧版本后重试。"
    exit 1
  fi
else
  log "安装 Node.js ${NODE_VERSION}（国内镜像）..."
  curl -fsSL -o /tmp/node.tar.xz "${NODE_MIRROR}/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz"
  mkdir -p "$NODE_DIR"
  tar -xJf /tmp/node.tar.xz -C "$NODE_DIR"
  ln -sf "${NODE_DIR}/node-${NODE_VERSION}-linux-x64/bin/node" /usr/local/bin/node
  ln -sf "${NODE_DIR}/node-${NODE_VERSION}-linux-x64/bin/npm"  /usr/local/bin/npm
  ln -sf "${NODE_DIR}/node-${NODE_VERSION}-linux-x64/bin/npx"  /usr/local/bin/npx
  # 关键：让 npm 全局安装（pnpm/pm2 等）落在 /usr/local/bin，保证在 PATH 中可直接调用
  npm config set prefix /usr/local
  log "Node.js 安装完成：$(node -v)"
fi

# npm 使用国内镜像（加速全局安装）
npm config set registry "$NPM_MIRROR" || true

# ---------- 2. pnpm + pm2 ----------
command -v pnpm >/dev/null 2>&1 || { log "安装 pnpm..."; npm install -g pnpm; }
command -v pm2  >/dev/null 2>&1 || { log "安装 pm2（进程守护）..."; npm install -g pm2; }

# 安装后校验：如果命令仍找不到，直接报错而不是继续
command -v pnpm >/dev/null 2>&1 || { echo "pnpm 安装后仍不可用，请检查 npm prefix 设置（npm config get prefix）"; exit 1; }
command -v pm2  >/dev/null 2>&1 || { echo "pm2 安装后仍不可用，请检查 npm prefix 设置（npm config get prefix）"; exit 1; }

# ---------- 3. 拉取代码 ----------
if [ -d "$APP_DIR/.git" ]; then
  log "项目已存在，拉取最新代码..."
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
else
  log "克隆代码到 $APP_DIR ..."
  git clone -b "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi

# ---------- 4. 安装依赖 + 构建 ----------
cd "$APP_DIR/frontend"
log "安装依赖..."
pnpm install --frozen-lockfile || pnpm install
log "构建生产版本（需要一两分钟）..."
NODE_OPTIONS="--max-old-space-size=768" pnpm build

# ---------- 5. 生成 pm2 配置并启动 ----------
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: "ai-calendar",
    cwd: "$APP_DIR/frontend",
    script: "node_modules/next/dist/bin/next",
    args: "start -p $PORT -H 0.0.0.0",
    instances: 1,
    autorestart: true,
    max_memory_restart: "500M",
    env: { NODE_ENV: "production", TZ: "Asia/Shanghai" }
  }]
};
EOF

log "启动服务（端口 $PORT）..."
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || warn "pm2 开机自启配置未生效，可在部署完成后手动执行 pm2 startup"

# ---------- 6. 防火墙提示 ----------
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
  warn "已在 ufw 中放行 ${PORT} 端口"
fi
warn "请同时到云服务器控制台的「安全组」放行 TCP ${PORT} 端口，否则外部无法访问"

PUBLIC_IP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || echo "你的服务器公网IP")
log "部署完成！"
echo ""
echo "  访问地址：http://${PUBLIC_IP}:${PORT}"
echo ""
echo "  常用命令："
echo "    pm2 logs ai-calendar      # 查看运行日志"
echo "    pm2 restart ai-calendar   # 重启服务"
echo "    pm2 stop ai-calendar      # 停止服务"
echo "  数据位置：$APP_DIR/database/data（更新代码不会影响数据）"
echo ""

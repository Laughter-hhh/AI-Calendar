# 部署指南：国内免费云服务器（方案 A）

把 AI Calendar 部署到一台国内云服务器，让其他人通过公网地址访问。全程免费（新用户试用期），数据保存在服务器硬盘上，国内访问速度快。

## 你需要准备

1. **一个代码仓库**（GitHub 或 Gitee），用来存放项目代码和后续更新
2. **一台免费的云服务器**（阿里云 / 腾讯云新用户免费试用，Ubuntu 22.04 或 24.04，1 核 1G 即可）

---

## 第一步：把代码推到仓库

### 1.1 创建仓库

- GitHub：https://github.com → New repository → 名字填 `AI-Calendar` → 不要勾选任何初始化选项 → Create
- 国内用户也可以选 Gitee（码云）：https://gitee.com → 新建仓库，同样叫 `AI-Calendar`

### 1.2 推代码

在本机项目目录 `E:\project\AI-Calendar` 打开终端，执行（把地址换成你自己的）：

```bash
git config user.name "你的名字"
git config user.email "你的邮箱"
git commit -m "feat: AI Calendar MVP 骨架"
git branch -M main
git remote add origin https://github.com/你的账号/AI-Calendar.git
git push -u origin main
```

> 如果仓库文件较多，首次 push 可能比较慢，耐心等即可。

## 第二步：申请免费云服务器

以阿里云为例（腾讯云流程类似）：

1. 打开 https://www.aliyun.com ，注册并完成**实名认证**
2. 搜索进入「免费试用」专区，找到「云服务器 ECS」或「轻量应用服务器」的免费套餐
3. 创建时选择：
   - 系统镜像：**Ubuntu 22.04**（或 24.04）
   - 地域：离测试用户近的就行（测试用户都在国内选国内地域即可）
   - 登录方式：设置 root 密码，或创建密钥对
4. 创建成功后，在控制台记下**公网 IP 地址**
5. 在控制台的「安全组 / 防火墙」规则里，**放行 TCP 3000 端口**（入方向）

## 第三步：一键部署

拿到服务器后，用终端软件（Windows 自带 PowerShell 或 MobaXterm）登录服务器，然后执行：

```bash
# 1. 安装 git（一般自带）
sudo apt-get update -y && sudo apt-get install -y git

# 2. 把项目克隆到临时目录
git clone -b main https://github.com/你的账号/AI-Calendar.git /tmp/aical

# 3. 运行一键部署脚本（脚本会自动装 Node、拉代码、构建、启动）
sudo bash /tmp/aical/deploy/server-setup.sh https://github.com/你的账号/AI-Calendar.git main
```

脚本会打印出访问地址，例如 `http://123.45.67.89:3000`。

部署内容说明：

- Node.js 24（国内镜像下载，内置 SQLite，无需装数据库软件）
- 项目放在 `/opt/ai-calendar`
- 用 pm2 守护进程，服务器重启后服务自动恢复
- 数据库自动创建在 `/opt/ai-calendar/database/data`，**更新代码不会丢数据**

## 第四步：验证与分享

1. 自己先打开 `http://公网IP:3000`，注册一个账号，创建一条日程
2. 确认没问题后，把地址发给朋友
3. 想用更好记的地址，以后可以买域名解析到这台服务器（进阶，暂不需要）

## 日常维护

**查看日志 / 重启 / 停止：**

```bash
pm2 logs ai-calendar
pm2 restart ai-calendar
pm2 stop ai-calendar
```

**更新代码到最新版本：**

```bash
cd /opt/ai-calendar
git pull
cd frontend
pnpm install
pnpm build
pm2 restart ai-calendar
```

**配置真实 AI 服务（可选）：**

```bash
cd /opt/ai-calendar/frontend
cp .env.example .env.local
nano .env.local        # 填入 OPENAI_API_KEY 等
pm2 restart ai-calendar
```

**备份数据（重要）：**

数据库只是一个文件，复制走即可：

```bash
cp /opt/ai-calendar/database/data/ai-calendar.db ~/ai-calendar-backup.db
```

## 常见问题

| 现象 | 解决办法 |
|---|---|
| 外网打不开，本机 curl 能通 | 检查云控制台「安全组」是否放行了 3000 端口 |
| 提示内存不足 / 构建失败 | 脚本已自动开 1G swap；仍失败可把服务器升到 2G |
| 想换端口 | 运行时 `PORT=8080 bash deploy/server-setup.sh ...`，或改 pm2 配置后 `pm2 restart` |
| 忘记服务器密码 | 在云控制台「重置实例密码」 |
| 想用自己的域名 | 域名解析 A 记录指向公网 IP，端口默认 80/443 需用 nginx 反代（进阶） |

## 如果不想用 Git 仓库

一键脚本依赖 Git 仓库地址（用于首次拉取和以后的更新）。如果暂时没有仓库，也可以手动部署：把本地项目（排除 `node_modules` 和 `.next`）压缩后上传到服务器，装好 Node.js 和 pnpm 后依次执行 `pnpm install`、`pnpm build`、`pm2 start`。但还是建议建一个仓库，以后更新会省心很多。

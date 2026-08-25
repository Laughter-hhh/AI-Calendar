# 部署指南：GitHub Actions 云端构建 + 自动部署（零成本）

适合服务器配置较低（比如 2G 内存构建很吃力）的情况。思路：

- **构建**：在 GitHub 的免费构建机上完成（内存充足，几分钟搞定）
- **运行**：产物自动传到你的 ECS，服务器只负责运行（pm2 守护）
- **更新**：以后本地 `git push`，网站自动更新，不用再登录服务器构建

## 原理

```
你本地 git push
    │
    ▼
GitHub Actions（免费构建机）
    ├── 安装依赖 → 构建（standalone 自包含产物）
    │
    ▼
自动上传到服务器 /opt/ai-calendar/app
    │
    ▼
pm2 自动重启 → 网站更新完成
```

## 一次性准备（只需做一次）

### 1. 在服务器上生成 SSH 密钥（登录服务器终端执行）

```bash
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -f /root/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519
grep -qxF "$(cat /root/.ssh/id_ed25519.pub)" /root/.ssh/authorized_keys 2>/dev/null || cat /root/.ssh/id_ed25519.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
cat /root/.ssh/id_ed25519
```

最后一条会把**私钥**打印出来（`-----BEGIN OPENSSH PRIVATE KEY-----` 到 `-----END...` 之间的全部内容），复制保存，下一步要用。

### 2. 在 GitHub 仓库里配置 3 个密钥

GitHub 仓库页面 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，依次添加：

| 密钥名 | 值 |
|---|---|
| `SSH_HOST` | `39.106.121.28` |
| `SSH_USER` | `root` |
| `SSH_PRIVATE_KEY` | 上一步复制的那段私钥（整段） |

### 3. 推送代码触发第一次部署

在你本地项目目录执行：

```bash
git push
```

然后打开 GitHub 仓库 → **Actions** 标签页，能看到「Build & Deploy」正在运行；等它跑完（约 3~6 分钟），网站就上线了。

## 日常更新代码

```bash
git add -A
git commit -m "改了什么"
git push
```

推送即部署，无需登录服务器。

## 验证与排查

- 网站地址：http://39.106.121.28:3000
- 看部署日志：GitHub 仓库 → Actions → 点击最新一次运行
- 服务器上查看运行状态：`pm2 status`、`pm2 logs ai-calendar --lines 30`

## 常见问题

| 现象 | 解决办法 |
|---|---|
| Actions 里显示 `SSH_PRIVATE_KEY` 相关错误 | 检查三个密钥是否都添加、私钥是否整段复制 |
| 构建失败 | 打开 Actions 日志看具体报错，把内容发给我们排查 |
| 想换服务器 | 把三个密钥的值改成新服务器的 IP/用户/私钥 |
| 配置真实 AI Key | 编辑 `ecosystem.config.cjs` 里的 `env` 加一行 `OPENAI_API_KEY: "你的key"`，推上去即可 |
| 数据在哪 | `/opt/ai-calendar/database/data/ai-calendar.db`，更新代码不会丢 |

## 服务器上的目录结构

```
/opt/ai-calendar/
├── app/                # 每次部署自动替换（构建产物）
└── database/data/      # 数据库（永久保留，不随部署清空）
```

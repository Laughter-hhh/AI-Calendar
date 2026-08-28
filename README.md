# AI Calendar

AI 原生的个人时间管理助手（MVP 技术验证版）。你不需要手动管理复杂日程，只要用自然语言告诉 AI 你要做什么，AI 负责解析并生成日程。

## ✨ 已实现功能（MVP）

- **自然语言创建日程**：输入“明天下午三点开会”，自动解析出标题、日期、时间
- **连续多天**：输入“从今天开始连续四天晚上八点学习 Python”，自动生成 4 个日程
- **重复事件**：每天 / 每周 / 每月按规则自动出现在后续日期，支持截止日期和“仅删除本日”
- **AI 修改日程**：输入“把学习改到晚上九点”或“删除明天的会议”，确认后直接生效
- **信息追问**：信息不完整时 AI 会提问，不擅自猜测（如只说了时间没说明天，会问“哪天？”）
- **语音输入**：点击麦克风按钮说话，自动转文字（Chrome / Edge 支持）
- **今日日程 + 未来 7 天视图**：单日 / 周视图切换，支持编辑、删除
- **勾选完成**：日程前打勾标记完成（划线置灰），也支持说"完成学习"让 AI 帮你标记
- **共享日历**：把自己的日历共享给同伴（输入对方邮箱），对方登录后即可查看（只读），入口在首页底部「共享日历」
- **语音输入**：桌面浏览器直接说话；手机端录音上传识别（需配置语音服务 Key）
- **自动更新**：检测到新版本自动提示刷新；每日日程自动分为「定时日程」和「待办事项」
- **移动端优化**：日期切换前端即时响应；紧凑工具条，日程区域占比更大
- **双排版**：网页端与手机端自动切换不同布局（桌面宽松版 / 移动紧凑版）
- **离线使用**：打开过的日程会缓存到本地，断网时可继续查看（显示"离线模式"提示）
- **混合识别**：联网时用 AI 大模型解析，离线/未配置时自动用本地规则解析器（信息缺失会追问）
- **双界面**：时间安排（7 天 × 时间块）/ 单日事项（定时 + 待办）自由切换
- **无时间待办**：说"待办：明天交报告"或点"＋待办"即可添加，不再强制要时间
- **设置入口**：顶部 ⚙️ 设置，集中账号、共享日历、下载 App 等
- **极简主界面**：日程优先——附加功能（搜索/待办/导出导入/设置等）都收进「⋯ 更多」菜单
- **简单账号体系**：邮箱 + 密码注册登录（密码使用 scrypt 加密，会话用 httpOnly Cookie）
- **模型可替换**：配置 API Key 时调用 AI 服务；未配置时使用内置本地解析器，核心闭环依然可跑

## 📁 目录结构

```
AI-Calendar
├── docs/
│   ├── AI-Calendar-Product-Specification.md   # 产品规划文档
│   └── LEARNING.md                            # 学习笔记（推荐阅读）
├── frontend/               # Next.js 应用（界面 + API 路由）
│   └── src/
│       ├── app/            # 页面 + API 接口
│       ├── components/     # 界面组件
│       └── lib/            # 数据库、认证、事件数据层
├── backend/
│   └── ai/                 # AI 服务层（模型可替换）
├── database/
│   ├── schema.sql          # 数据库表结构
│   └── init.mjs            # 数据库初始化脚本
└── scripts/
    └── smoke-test.mjs      # 一键冒烟测试
```

## 🚀 快速开始

环境要求：Node.js 22.5+（推荐 24）与 pnpm。

```bash
# 1. 安装依赖
cd frontend
pnpm install

# 2. 启动开发服务器（数据文件会自动创建）
pnpm dev
```

打开 http://localhost:3000 即可使用。

生产模式：

```bash
cd frontend
pnpm build
pnpm start
```

在项目根目录也提供了快捷命令：`pnpm dev` / `pnpm build` / `pnpm start`。

## 🌐 部署到公网

想让别人也能打开这个网站，参考 [部署指南](deploy/DEPLOYMENT.md)：申请一台国内免费云服务器，运行一键部署脚本即可（保留 SQLite，国内访问快，适合小范围测试）。

如果选择 Google Cloud 免费服务器，见 [Google Cloud 部署指南](deploy/GCP-DEPLOYMENT.md)（含免费额度限制说明和防扣费要点）。

如果服务器配置较低、不想在服务器上构建，可使用 **GitHub Actions 云端构建 + 自动部署**（零成本，`git push` 即自动更新），见 [CI 部署指南](deploy/CI-DEPLOYMENT.md)。

## 📱 手机 App

已提供基于 Expo 的手机端 App（WebView 壳，先快速上线）：见 [mobile/README.md](mobile/README.md)。用 Expo Go 扫码即可在手机上预览，也可打包成安卓 APK 安装。

**安卓独立安装包（无需 Expo Go）**：访问 http://39.106.121.28:3000/download 直接下载安装。商店上架的成本、审核与更新难点见 [APP-STORE.md](docs/APP-STORE.md)。

**iPhone 用户**：iOS 不支持直接下载安装包。用 Safari 打开网站 → 分享 →「添加到主屏幕」即可得到 App 图标入口；正规测试分发走 TestFlight（需 Apple 开发者账号，配置已就绪，见 [mobile/README.md](mobile/README.md)）。

## 🌐 关于域名

当前用 IP + 端口访问（http://39.106.121.28:3000），适合小范围测试。正式对外发布需要域名：**国内服务器的网站绑定域名需要 ICP 备案**（约 1~2 周），备案通过后即可用 80/443 端口 + HTTPS。域名与备案已列入 V3 公网发布计划。

### 服务器怎么选（按测试用户所在地）

| 你的情况 | 推荐 |
|---|---|
| 测试用户主要在国内（最常见） | 国内云免费试用（阿里云/腾讯云，2核 1~2G，免费 1~3 个月），试用后转小套餐（约 ¥20~40/月） |
| 测试用户主要在海外 | Google Cloud 免费层（e2-micro 永久免费，但大陆访问不了） |
| 今天就临时给几个人看 | 内网穿透（cpolar / natapp，免费，1M 带宽，电脑需开机） |

当前 MVP 测试阶段建议：**国内云为主，Google 仅用于海外用户，内网穿透做即时演示**。

## 🤖 配置 AI 服务（可选）

不配置也能用（走内置本地解析器）。配置后使用 OpenAI 兼容接口：

> 选型、配置、验证、安全与常见坑，见 [AI 配置实战手册](docs/AI-CONFIG-HANDBOOK.md)。

```bash
cd frontend
copy .env.example .env.local   # PowerShell
```

编辑 `.env.local`：

```
OPENAI_API_KEY=你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1   # 可换成任意兼容服务
OPENAI_MODEL=gpt-4o-mini
```

### 服务器配置（推荐，手机端语音识别必须）

在服务器上创建 `/opt/ai-calendar/config.env`（在应用目录之外，部署不会覆盖）：

```bash
sudo nano /opt/ai-calendar/config.env
```

填入：

```
OPENAI_API_KEY=你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_STT_MODEL=whisper-1
```

然后重启服务：`pm2 restart ai-calendar`。配置后：AI 解析升级为模型版，**手机端语音识别也可用**（费用极低，Whisper 约 ¥0.04/分钟）。

## 🧪 测试

启动服务后，在项目根目录运行：

```bash
pnpm test:smoke
```

会依次验证：首页访问、注册、AI 解析（连续四天 / 明天下午三点 / 缺失追问）、事件保存/查询/修改/删除、未登录拦截。

## 🗺️ 路线图

- **V1（当前）**：跑通 AI 创建日程闭环
- **V2**：完善 UI、稳定数据保存、更强 AI 交互、移动端优化
- **V3**：多用户、云端同步、公网部署、Google/Apple/Microsoft 登录

详细规划见 [产品文档](docs/AI-Calendar-Product-Specification.md)。

## 💰 成本与融资

低价 AI Key、免费 AI 选项、融资时机与成本决策原则，见 [成本与融资思考](docs/COST-AND-FUNDING.md)。

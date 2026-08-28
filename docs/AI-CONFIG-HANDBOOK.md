# AI 与语音配置实战手册

> 本文档是"配置 AI 服务"的一线实践记录（2026-08-28 实测），含选型、配置、验证、安全与常见坑。新接手者可照此操作。

## 一、怎么选 Key（性价比结论）

| 方案 | 结论 | 备注 |
|---|---|---|
| **DeepSeek 官方 API**（platform.deepseek.com） | ⭐ 推荐主力 | 中文理解强、价格极低；注意网页版余额与 API 平台余额**不通用**，需单独充值（10~20 元用很久） |
| 硅基流动（SiliconFlow） | 适合 0 元试跑 | 注册送额度 + 免费模型；模型多但质量参差 |
| 智谱 GLM-4-Flash | 免费档备选 | 轻量任务够用 |
| 通义 qwen-turbo | 备选 | 阿里系稳定 |

**实战结论：解析一句中文日程约 0.01~0.02 元/次，月成本几块钱内——按"中文理解质量 + 稳定"选，DeepSeek 综合最优。**

## 二、配置步骤

### 服务器（生产，推荐）

1. 登录服务器终端，创建/编辑 `/opt/ai-calendar/config.env`（在应用目录外，CI 部署不会覆盖）：

```bash
sudo nano /opt/ai-calendar/config.env
```

2. 填入（按所选平台改三行）：

```
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
OPENAI_API_KEY=sk-你的密钥
OPENAI_STT_MODEL=whisper-1
```

3. 保存并重启：

```bash
pm2 restart ai-calendar
```

> 用 PowerShell 一行改模型：`ssh root@服务器IP "sed -i 's|OPENAI_MODEL=.*|OPENAI_MODEL=deepseek-chat|' /opt/ai-calendar/config.env && pm2 restart ai-calendar"`

### 本地开发（可选）

复制 `frontend/.env.example` → `.env.local` 填 `OPENAI_API_KEY` 等即可。

## 三、验证方法

1. **网页实测**：输入一句复杂的话（如"明天下午三点开完会之后去健身房"），观察解析是否规范
2. **接口验证**（从任何机器）：注册临时账号 → 调 `POST /api/ai/parse` → 看返回的 `provider` 字段
   - `provider: openai` = 模型版生效
   - `provider: local-rule-based` = 未配置 Key 或模型失败，走本地规则

## 四、模型选择实战结论（重要）

- **7B 级小模型（如 Qwen2.5-7B）对"严格结构化输出"遵从度很低**：实测把"明天下午三点"输出成日期 `2`、时间 `1`，不可用
- **建议使用 V3 级模型**：DeepSeek 官方 `deepseek-chat`（即 V3）效果良好，能正确换算日期、规范时间、拆分多日程
- **系统已内置三道保险**：
  1. 提示词注入"今天日期（中国时区）"，要求相对日期按此换算
  2. 输出校正层：模型乱填时用本地规则兜底，仍无效则转追问，杜绝脏数据入库
  3. 兼容模型输出带 ```json 代码块围栏

## 五、语音配置

| 端 | 方案 |
|---|---|
| 桌面 Chrome/Edge | 浏览器内置语音，无需配置，点麦克风直接说话 |
| 手机端（录音上传） | 需要平台支持 `/audio/transcriptions`（Whisper 类接口）。**DeepSeek / 硅基流动目前不支持** → 手机语音请用系统键盘"听写"（免费零成本） |
| iOS "Siri 模式" | 用键盘听写（苹果语音引擎）或 iOS 14.5+ 浏览器语音；真正的"Hey Siri 直接调用"需原生 App（路线图） |

## 六、安全要点

- API Key **只存在服务器 `/opt/ai-calendar/config.env`**，不提交代码仓库、不发聊天
- Key 若在聊天/日志中暴露过，**立即到平台后台重新生成并删除旧 Key**
- 每次换平台只需改 `config.env` 三行（BASE_URL / MODEL / API_KEY）

## 七、混合识别模式（联网 AI / 离线规则）

```
用户输入
   ├─ 联网 + 已配 Key ──► OpenAI 兼容大模型（deepseek-chat 等）
   │                        └─ 校正层（规范日期/时间，脏数据转追问）
   └─ 离线 / 未配 Key / 模型失败 ──► 本地规则解析器
                                       └─ 自动分割：连续N天/重复/日期/时间/标题
                                          缺失信息追问
```

每次解析返回 `provider` 字段标明所用模式，无需手动切换。

## 八、本次实战记录（2026-08-28）

1. 配置硅基流动 Key + Qwen2.5-7B → 实测输出乱格式（日期"2"、时间"1"）
2. 加"输出校正层"（v3.10.1）→ 脏数据不再入库，转为追问
3. 实测 DeepSeek-V3 → 结构规范，但日期算错年份（2023）且带 ```json 围栏
4. 提示词注入今天日期 + 兼容围栏（v3.10.2）→ 修复
5. 改用 DeepSeek 官方 `deepseek-chat` → 线上验证通过："明天下午三点开完会之后去健身房" → `2026-08-29 15:00 开会` + `2026-08-29 去健身房`

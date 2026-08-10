# backend/

后端服务层。当前 MVP 中"后端"由两部分组成：

1. **API 路由**：位于 `frontend/src/app/api/`，由 Next.js 提供（即文档中的 "Next.js Server API"）
2. **AI 服务层**：位于 `backend/ai/`，独立于前端与数据库，负责"自然语言 → 结构化日程"

## AI 服务层设计

```
backend/ai/
├── types.ts               # 统一的数据结构（事件、解析结果）
├── service.ts             # 入口：选择模型，失败时自动回退
└── providers/
    ├── openai.ts          # OpenAI 兼容接口（可换任意兼容服务）
    └── local.ts           # 本地规则解析器（无需网络和 API Key）
```

核心原则（对应产品文档第 8 节）：

- 上层 API 只依赖 `types.ts` 中定义的统一结构，不关心具体用哪个模型
- 配置了 `OPENAI_API_KEY` 时优先调用 AI 服务；未配置或调用失败时回退到本地解析器
- 这样"模型可替换"，且没有 Key 也能完整跑通 MVP 闭环

# CampusAgent

HKBU 校园智能助手的**独立可运行**版本。从 [HKCampus](../HKCampus) 项目中抽取出 agent 模块，配上全新的本地 Web 前端 + Node 后端，复用同一套 DeepSeek 与 Supabase 后端，无需 Expo / React Native 即可在浏览器中运行。

## 架构

**主路径：LangGraph 流水线**（`services/agent/graph`）。由于 LangGraph 无法在 iOS app 端运行，原项目在移动端用 ReAct 顶替；本独立 Web/Node 项目不受此限制，已切回 LangGraph 作为主架构。

```
START
  → normalize_input      规范化输入
  → route_intent         意图分类（router.classifyIntent）
  → retrieve_context     RAG 检索（FAQ + 知识库向量搜索 + 用户记忆）
  → plan_next_step       规划：answer / clarify / act
  → clarify_user | prepare_action → confirm_action → execute_tools
  → synthesize_response  DeepSeek 合成最终回复
  → write_memory         抽取并持久化记忆事实
  → END
```

三层运行时（与原项目一致，仅把主路径从 ReAct 换回 LangGraph）：

1. **LangGraph runtime（主路径）** — 问答 / 检索 / 规划 / 工具执行的完整状态图。
2. **Action Agent runtime（写操作）** — `ACTION_AGENT_ENABLED` 时，课程/教师评价、组队、课程群消息、日历、课表写入路由至此，生成带确认流程的结构化 `actionPayload`。
3. **ReAct + Fallback LLM（降级）** — LangGraph 抛错时降级到 DeepSeek function-calling 的 ReAct loop，再不行则纯 LLM 直答。

```
CampusAgent/
├── server/index.ts        # Express 后端：POST /api/chat，托管 web 静态资源
├── web/                   # 纯 HTML/CSS/JS 聊天前端（无构建步骤）
├── services/agent/
│   ├── graph/             # LangGraph 主流水线（nodes / edges / retrieval / prompts）
│   ├── react_runtime/     # ReAct 降级路径
│   ├── action_runtime/    # Action Agent 写操作路径
│   └── executor.ts        # 入口适配器：graph → react → fallback
├── services/*.ts          # Node 兼容的数据层 shim（复用真实 Supabase 表）
├── data/                  # 静态数据（buildings、campus_faq）
├── types/index.ts         # 精简共享类型
└── app/i18n/i18n.ts       # 精简 i18n shim
```

后端在内存中按 `sessionId` 维护 `AgentExecutor` 实例，因此每个浏览器会话独立保留对话历史、记忆与待确认草稿。

**数据层复用**：`services/` 下的 shim 直接连接 HKCampus 的生产 Supabase 项目（凭据在 `.env`），因此 FAQ 知识库向量检索、记忆、写评价等命中的是真实后端数据。

> 注：LangGraph 流水线的 `retrieve_context` 只检索 FAQ / 知识库 / 记忆；查建筑、查课表等"读工具"是 ReAct runtime 的能力，graph 残留版本并未接入这些读工具（保持原项目残留原貌）。如需在 graph 中接入这些读工具，可在 `retrieve_context` / `execute_tools` 节点扩展。

## 运行

```bash
npm install
npm start          # 或 npm run dev（监听文件变化自动重启）
```

打开 http://localhost:3100 （端口可在 `.env` 的 `PORT` 修改）。

## 配置

复制 `.env.example` 为 `.env` 并填写：

| 变量 | 说明 |
|------|------|
| `EXPO_PUBLIC_DEEPSEEK_API_KEY` | DeepSeek API Key（必填） |
| `EXPO_PUBLIC_AGENT_FAST_MODEL` | 默认 `deepseek-chat` |
| `EXPO_PUBLIC_AGENT_REASONING_MODEL` | 默认 `deepseek-reasoner` |
| `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Supabase 连接（课表/建筑/FAQ-KB/记忆工具需要） |
| `PORT` | 后端端口，默认 3100 |

> 仓库自带的 `.env` 已填入 HKCampus 的可用凭据，开箱即跑。`.env` 已在 `.gitignore` 中。

## API

- `GET /api/health` → `{ ok, deepseekConfigured, fastModel, reasoningModel }`
- `POST /api/chat` → body `{ sessionId?, message, location?, userId? }`，返回 `{ sessionId, reply, steps, actionPayload }`
- `POST /api/reset` → body `{ sessionId }`，清空该会话

## 与 HKCampus 的关系

- 仅做**复制**，未改动 HKCampus 任何文件。
- `services/agent/**`（含完整 `graph/` 流水线、`react_runtime/`、`action_runtime/`）为逐字复制；`dailyDigest/` 因依赖推送/i18n 过重未复制。
- `services/agent/executor.ts` 做了最小改动：主路径从 `processWithReactLoop` 切换为 `processWithGraphRuntime`（调用 `runAgentGraph`），ReAct 退为降级路径。
- `services/faq.ts` 把 `require('./supabase')` 改为 ESM `import`（Node ESM 下 `require` 未定义）。
- React Native / Expo 专有的数据服务（supabase、schedule、faq、courses、teaming、calendar、teachers、buildings）被替换为等价的 Node 兼容实现，命中同样的 Supabase 表。
- 新增依赖：`@langchain/langgraph`。

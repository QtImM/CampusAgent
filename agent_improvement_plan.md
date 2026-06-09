# CampusAgent 检索链路深度改进规划

> 目标：把 graph 主路径的 RAG 从「关键词启发式 + 单路向量」升级为「混合召回 + ML 重排 + 可量化评测」的工程化检索系统。
> 配套语境：HKCampus_RAG 面试备战手册「项目短板与改进方案」一节 —— 主动承认短板并给出可落地的演进路线。

---

## 一、现状诊断

### 1.1 当前检索链路（LangGraph 主路径）

```
retrieve_context (节点)
  └─ retrieveEvidenceBundle()            services/agent/graph/retrieval/retrievers.ts
       ├─ FAQService.searchFAQs()        本地 campus_faq.json 关键词打分（scoreFaqMatch）
       ├─ FAQService.searchKnowledgeBase()  Supabase Edge Function `embed-search`
       │                                    （云端 embedding + pgvector，match_count=5）
       │                                    失败降级 → ILIKE 关键词
       └─ getAllUserFacts()              用户记忆
  └─ rankEvidence()                      services/agent/graph/retrieval/rerank.ts
       trustWeight[sourceType] + topic/content.includes(query) 加分 → sort
```

### 1.2 短板逐条定位（对照面试手册图）

| # | 真实局限 | 代码落点 | 现状本质 |
|---|---------|---------|---------|
| 1 | 重排是关键词启发式，非 ML reranker | [`rerank.ts:12` `rankEvidence`](services/agent/graph/retrieval/rerank.ts#L12)、[`retrieval.ts:72` `rerankKnowledgeBaseResults`](services/agent/retrieval.ts#L72) | `score = trustWeight + includes()` 命中加分，无语义打分 |
| 2 | 没有混合检索（hybrid search） | [`retrievers.ts:8`](services/agent/graph/retrieval/retrievers.ts#L8) | FAQ 关键词路 + KB 向量路是两条独立路，简单拼接后启发式排序，无 RRF 融合 |
| 3 | 缺系统化离线评测 | 全项目无 `eval/` 目录 | 改阈值/换模型无法量化回归，全靠人工试 |
| 4 | query embedding 走公网 API | [`faq.ts:226` `embed-search`](services/faq.ts#L226) | 依赖 Supabase Edge Function 云端 embedding，有延迟与稳定性风险 |
| 5 | embedding 模型对中文非最优 | Edge Function 内的模型 | 中文为主语料，召回质量受限 |
| 6 | chunk 策略偏简单（固定长度） | `agent_knowledge_base` 表的入库流程 | 固定长度切分，召回精度与上下文完整难两全 |

> 说明：1/2 在 Node 端（本仓库可改）；4/5/6 在 Supabase Edge Function 与入库管线（需在数据侧改），本规划给出两侧的协同方案。

---

## 二、改进总览与优先级

排序原则：**先建评测（否则其他改进无法验证），再做高 ROI 的召回/重排，最后碰数据侧重活。**

| 阶段 | 主题 | 短板 | 价值 | 成本 | 优先级 | 状态 |
|------|------|------|------|------|--------|------|
| **P0** | 离线评测体系 | #3 | 高（所有改进的标尺） | 中 | 🔴 必做先行 | ✅ 已落地（Sprint 1） |
| **P1** | 混合检索 + RRF 融合 | #2 | 高 | 中 | 🔴 | ✅ 已落地（Sprint 2） |
| **P1** | Cross-encoder 两段式精排 | #1 | 高 | 中 | 🔴 | ✅ 已落地（Sprint 3，默认 `provider=none` 降级启发式） |
| **P2** | 自建/本地 embedding 服务 | #4 | 中 | 中高 | 🟡 | ⬜ 未开始 |
| **P2** | 中文友好 embedding（bge-m3） | #5 | 中高 | 中（需重灌库） | 🟡 | ⬜ 未开始 |
| **P3** | 语义/父子分块 | #6 | 中 | 高（重建索引） | 🟢 | ⬜ 未开始 |

> **Sprint 1–3 实施状态（2026-06-09）**：P0 + 两项 P1 已落地并通过 `npm run typecheck`，`npm run eval` 可一键产出基线。
> 全部改动配置化（`HYBRID_SEARCH_ENABLED` / `RERANKER_PROVIDER` 等），默认保持现有行为可降级，未触碰 Supabase 数据侧（#4/#5/#6 仍待数据侧排期）。

---

## 三、分阶段详细方案

### P0 · 离线评测体系（先行，贯穿全程）

**为什么先做**：#1/#2/#4/#5/#6 任何一项改完都需要回答「召回率/忠实度有没有变好」。没有评测集，所有改进都是盲调。

**落地步骤**
1. 建标注集 `eval/dataset.jsonl`：50–100 条真实校园问题，每条标注
   `{ query, expected_chunks: [chunk_id...], gold_answer }`。来源：现有 `campus_faq.json` + 真实对话日志。
2. 接入 **RAGAS** 量化指标（Python 侧脚本 `eval/run_eval.py`，复用项目已有的 `docx_skill.py` 同级 Python 环境）：
   - `context_recall`（召回是否覆盖到答案所需片段）
   - `context_precision`（召回里有多少是相关的）
   - `faithfulness`（回答是否忠于检索证据，反幻觉）
   - `answer_relevancy`
3. 检索层加 **trace 输出**：在 `retrieveEvidenceBundle` 增加可选 `debug` 返回（命中的 chunk_id、各路分数、最终 rank），供评测脚本对齐。
4. 建立基线：跑当前链路得到一组 baseline 数字，写入 `eval/baseline.md`。

**涉及文件**：新建 `eval/`，改 [`retrievers.ts`](services/agent/graph/retrieval/retrievers.ts)（暴露 debug trace）、[`telemetry.ts`](services/agent/graph/telemetry.ts)（记录检索指标）。

**验收**：`npm run eval` 一键输出指标表；后续每个阶段以 baseline 为对照报告 Δ。

> ✅ **已落地（Sprint 1）**
> - `EvidenceItem` 新增稳定 `sourceId`（FAQ→faq.id / KB→metadata 键或内容哈希 / memory→fact key），见 [`evidence.ts`](services/agent/graph/retrieval/evidence.ts)；新增 `RetrievalDebug` 类型（[`types.ts`](services/agent/graph/types.ts)）。
> - `retrieveEvidenceBundle(state, { debug })` 输出每路候选 / RRF 融合 / 最终 rank / rerankProvider；`retrieve_context` 节点把召回路计数与 reranker 写进 trace。
> - 标注集 [`eval/dataset.jsonl`](eval/dataset.jsonl)（21 条真实校园问题，中英 + 混合，引用真实 FAQ id）。
> - Node 侧 [`eval/retrieve_cli.ts`](eval/retrieve_cli.ts) 跑真实检索链路 → Python [`eval/run_eval.py`](eval/run_eval.py)（纯标准库）算 `context_recall` / `hit_rate@k` / `mrr@k`，写 [`eval/baseline.md`](eval/baseline.md)。
> - RAGAS 四指标（faithfulness/answer_relevancy/context_precision）需 LLM 评判，留可选 hook，未配置时跳过——核心检索指标始终离线可跑。
> - npm 脚本：`eval:retrieve`（产 runs）+ `eval`（runs→指标）。
> - **当前基线**：n=21，context_recall=1.000，hit_rate@4=1.000，mrr@4=0.964（rerank=heuristic）。种子集偏「同分布易例」，下一步应扩充改写/跨语/负例/多跳，给后续 P1/P2 留出提升空间。

---

### P1 · 混合检索 + RRF 融合（短板 #2）

**目标**：BM25/关键词路 与 向量路 **并行召回**，用 RRF（Reciprocal Rank Fusion）合并，中英混查更稳。

**方案**
- 向量路：保留 `embed-search` 召回（top 20）。
- 关键词路：升级 ILIKE 为 **Postgres 全文检索 / BM25**（`tsvector` 或 `pg_trgm`），同样 top 20。
- 融合：实现 `rrfFuse(rankedLists, k=60)`，`score = Σ 1/(k + rank_i)`，合并去重得到候选 top 20。

```
hybridRetrieve(query)
  ├─ vectorRecall(query, 20)     ─┐
  ├─ keywordRecall(query, 20)    ─┤→ rrfFuse(k=60) → top 20 候选
  └─ (FAQ 本地路同样并入)         ─┘
```

**为什么 RRF**：免调权重、对两路分数量纲不敏感，是混合检索的工业标准。中文问题命中关键词路、英文/语义问题命中向量路，互补。

**涉及文件**：新建 `services/agent/graph/retrieval/hybrid.ts`（RRF）、改 [`retrievers.ts`](services/agent/graph/retrieval/retrievers.ts)（改为调 hybrid）、[`faq.ts`](services/faq.ts)（keywordRecall 升级 BM25）。

**验收**：相对 P0 baseline，`context_recall` 提升；中英混查 case 通过率上升。

> ✅ **已落地（Sprint 2）**
> - 新建 [`hybrid.ts`](services/agent/graph/retrieval/hybrid.ts)：`rrfFuse(rankedLists, k=60)` 泛型实现（按 `${sourceType}:${sourceId}` 去重，`score=Σ1/(k+rank)`）+ `hybridRetrieve`（向量路=KB embed-search、关键词路=本地 FAQ，并行召回各 top20 后 RRF 融合）。
> - [`retrievers.ts`](services/agent/graph/retrieval/retrievers.ts) 改为 hybrid 主路径；`HYBRID_SEARCH_ENABLED=false` 时降级回原 legacy 单路链路。`RRF_K` 可配。
> - **BM25 关键词路**（Postgres `tsvector`/`pg_trgm`）属数据侧改动，本仓库未动库；`rrfFuse` 已泛型支持 N 路，BM25 上线后作为「第三个 rankedList」零代码接入。
> - 运行验证：eval CLI 实测向量路返回真实 KB chunk（`kb:hkbu-*.md#章节`）、关键词路返回 FAQ id，RRF 正确交错融合。

---

### P1 · Cross-encoder 两段式精排（短板 #1）

**目标**：把 `score = trustWeight + includes()` 的启发式重排替换为两段式 —— **向量/混合粗召回 top 20 → cross-encoder 精排 top 4**。

**方案**
1. 粗召回：P1 的 hybrid top 20 候选。
2. 精排：调用 reranker 对 `(query, chunk)` 逐对打分：
   - 方案 A（最快上线）：**Cohere Rerank API**（`rerank-multilingual-v3`，对中文好）。
   - 方案 B（自主可控）：本地 **bge-reranker-v2-m3** cross-encoder，HTTP 微服务暴露 `/rerank`。
3. 取精排 top 4 作为 evidence 传给 `synthesize_response`。
4. 保留 `trustWeight` 作为 **tie-break 兜底**（reranker 不可用时降级回现有启发式）。

```
hybrid top20 ──→ cross-encoder rerank ──→ top4 evidence ──→ synthesizer
                 (失败降级: rankEvidence 启发式)
```

**涉及文件**：改 [`rerank.ts`](services/agent/graph/retrieval/rerank.ts)（新增 `rerankWithCrossEncoder`，`rankEvidence` 降为 fallback）、[`config.ts`](services/agent/config.ts)（reranker 开关与 endpoint）、`.env.example`（`RERANKER_PROVIDER` / `COHERE_API_KEY` / `RERANKER_URL`）。

**验收**：`context_precision` 与 top-4 命中率明显优于启发式；端到端延迟在可接受范围（精排只对 20 条，<300ms）。

> ✅ **已落地（Sprint 3）**
> - [`rerank.ts`](services/agent/graph/retrieval/rerank.ts) 新增 `rerankWithCrossEncoder(query, evidence, topK)`：provider=`cohere`（Cohere Rerank API，`rerank-multilingual-v3.0`）/ `local`（自托管 bge-reranker-v2-m3 的 `POST /rerank`），对 `(query, topic+snippet)` 逐对打分取 top-K。
> - `rankEvidence` 保留为**启发式 fallback**：reranker 未配置 / 不可用 / 超时（`AbortController` + `RERANKER_TIMEOUT_MS`）/ 报错时自动降级，永不让管线无序。
> - 配置进 [`config.ts`](services/agent/config.ts) + [`.env.example`](.env.example)：`RERANKER_PROVIDER`（默认 `none`）、`COHERE_API_KEY`、`COHERE_RERANK_MODEL`、`RERANKER_URL`、`RERANKER_TIMEOUT_MS`、`EVIDENCE_TOP_K`。
> - 默认 `none` → 行为与改造前一致（启发式），上线接 reranker 仅需配环境变量，符合「配置化 + 全程降级链」原则。

---

### P2 · 自建/本地 embedding 服务（短板 #4）

**目标**：摆脱 query embedding 走 HF 公网 API 的延迟与稳定性风险。

**方案**
- 短期：给 `embed-search` 加 **超时 + 重试 + 本地缓存**（相同 query 短期缓存向量），降低抖动暴露。
- 中期：自建 embedding 微服务（FastAPI + sentence-transformers，或 Supabase 自托管推理），Node 侧通过 `EMBEDDING_URL` 调用，与 reranker 服务同机部署。
- 配置化：embedding provider 可切换（cloud / self-host / local），便于 A/B。

**涉及文件**：改 [`faq.ts:223`](services/faq.ts#L223)（embedding 调用抽象为 provider）、`config.ts`、`.env.example`（`EMBEDDING_PROVIDER` / `EMBEDDING_URL`）。

**验收**：P95 检索延迟下降且稳定，公网依赖移除后可用性指标改善。

---

### P2 · 中文友好 embedding（短板 #5）

**目标**：中文为主语料换用 **bge-m3** 或 **bge-small-zh**，提升召回质量。

**方案**
1. 选型：`bge-m3`（多语言 + 长文，中英混查友好）优先；轻量场景用 `bge-small-zh`。
2. **重灌向量库**：用新模型对 `agent_knowledge_base` 全量重新 embedding（注意向量维度变化，pgvector 列需迁移）。
3. query 与 doc 用**同一模型**，避免维度/分布不匹配。
4. 用 P0 评测集对比新旧模型的 `context_recall`，数据驱动决定是否切换。

**涉及文件**：数据侧入库脚本（Supabase）+ `agent_knowledge_base` schema 迁移；Node 侧仅改 provider 配置。

**风险**：需停机/灰度重灌库；维度迁移要谨慎。**先在 staging 表验证再切生产。**

---

### P3 · 语义 / 父子分块（短板 #6）

**目标**：替换固定长度切分为 **语义切分** 或 **父子文档（small-to-big）**：小块精准召回、大块补全上下文。

**方案**
- 父子分块：入库时存「小块（检索粒度）+ 父块（上下文粒度）」，检索命中小块后用 `parent_id` 取回父块喂给 LLM。
- 或语义切分：按标题层级 / 语义边界切（现有 metadata 已有 `h2`/`h3`，见 [`retrieval.ts:92`](services/agent/retrieval.ts#L92)，可直接利用标题结构做父子映射）。

**涉及文件**：数据侧入库管线 + `agent_knowledge_base` 增 `parent_id` / `chunk_level` 字段；Node 侧 `searchKnowledgeBase` 命中后做父块回填。

**验收**：`faithfulness` 与答案完整度提升；评测集长答案类问题改善。

---

## 四、里程碑排期

| 周期 | 交付 | 关键产出 | 状态 |
|------|------|---------|------|
| Sprint 1 | P0 评测体系 | `eval/` 数据集 + 评测脚本 + baseline 数字 | ✅ 已完成（baseline: recall 1.000 / mrr@4 0.964） |
| Sprint 2 | P1 混合检索 + RRF | `hybrid.ts`，召回率对照报告 | ✅ 已完成（RRF 泛型，向量+关键词双路融合） |
| Sprint 3 | P1 cross-encoder 精排 | reranker 接入 + 降级链，精度对照报告 | ✅ 已完成（cohere/local provider + 启发式降级） |
| Sprint 4 | P2 embedding 服务 + 中文模型 | provider 抽象 + 灰度重灌库 | ⬜ 待排期（数据侧） |
| Sprint 5 | P3 分块策略 | 父子分块入库 + 父块回填 | ⬜ 待排期（数据侧） |

---

## 五、贯穿原则与风险

1. **每一步都对照 P0 评测报数**：只接受 `context_recall`/`precision`/`faithfulness` 不退化的改动。
2. **全程保留降级链**：reranker / embedding 服务不可用时，自动降级回现有启发式与 ILIKE，符合本项目「三层运行时 + fallback」的既有设计哲学。
3. **数据侧改动（#5/#6）走 staging 验证再切生产**，避免重灌库影响线上。
4. **配置化优先**：provider / endpoint / 开关全部进 `config.ts` + `.env`，便于 A/B 与回退，不写死。
5. **不改动 HKCampus 源项目**：所有改进落在 CampusAgent 独立仓库与数据侧管线。

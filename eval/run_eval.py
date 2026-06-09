#!/usr/bin/env python3
"""
Offline eval — metrics (Python side).

Consumes the retrieval runs produced by `eval/retrieve_cli.ts` and computes
retrieval-quality metrics against the gold labels in `eval/dataset.jsonl`, then
writes a Markdown report to `eval/baseline.md`.

Computed natively (no LLM, fully offline/deterministic):
  - context_recall   : |gold ∩ retrieved_topk| / |gold|     (label-based)
  - hit_rate@k       : fraction of queries with ≥1 gold chunk in top-k
  - mrr@k            : mean reciprocal rank of the first gold chunk

The RAGAS quartet (faithfulness / answer_relevancy / context_precision /
context_recall-LLM) needs an LLM judge. If `ragas` is installed and an API key is
configured, the optional hook below can be enabled; otherwise it is skipped with a
clear note so the core report always runs.

Usage:
  tsx eval/retrieve_cli.ts eval/dataset.jsonl > eval/retrieval_runs.jsonl
  python eval/run_eval.py
"""
import json
import os
import statistics
from datetime import datetime, timezone

RUNS_PATH = os.path.join(os.path.dirname(__file__), "retrieval_runs.jsonl")
REPORT_PATH = os.path.join(os.path.dirname(__file__), "baseline.md")
TOP_K = int(os.environ.get("EVAL_TOP_K", "4"))


def load_runs(path):
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def evaluate(rows):
    per_query = []
    for r in rows:
        gold = set(r.get("expected_chunks") or [])
        retrieved = [item["sourceId"] for item in (r.get("final_ranked") or [])][:TOP_K]
        retrieved_set = set(retrieved)

        recall = (len(gold & retrieved_set) / len(gold)) if gold else 0.0
        hit = 1.0 if (gold & retrieved_set) else 0.0

        rr = 0.0
        for idx, sid in enumerate(retrieved, start=1):
            if sid in gold:
                rr = 1.0 / idx
                break

        per_query.append({
            "query": r.get("query"),
            "gold": sorted(gold),
            "retrieved": retrieved,
            "recall": recall,
            "hit": hit,
            "rr": rr,
            "rerank_provider": r.get("rerank_provider", "?"),
            "path_counts": r.get("path_counts", {}),
            "error": r.get("error"),
        })
    return per_query


def aggregate(per_query):
    if not per_query:
        return {"context_recall": 0.0, "hit_rate@k": 0.0, "mrr@k": 0.0, "n": 0}
    return {
        "context_recall": statistics.mean(q["recall"] for q in per_query),
        "hit_rate@k": statistics.mean(q["hit"] for q in per_query),
        "mrr@k": statistics.mean(q["rr"] for q in per_query),
        "n": len(per_query),
    }


def write_report(per_query, agg):
    provider = next((q["rerank_provider"] for q in per_query if q.get("rerank_provider")), "?")
    lines = []
    lines.append("# 检索离线评测基线（baseline）")
    lines.append("")
    lines.append(f"- 生成时间：{datetime.now(timezone.utc).isoformat()}")
    lines.append(f"- 样本数 n：{agg['n']}")
    lines.append(f"- top-K：{TOP_K}")
    lines.append(f"- rerank provider：`{provider}`")
    lines.append("")
    lines.append("## 汇总指标")
    lines.append("")
    lines.append("| 指标 | 值 | 说明 |")
    lines.append("|------|----|------|")
    lines.append(f"| context_recall | {agg['context_recall']:.3f} | 标注 gold chunk 落入 top-K 的比例（label-based） |")
    lines.append(f"| hit_rate@{TOP_K} | {agg['hit_rate@k']:.3f} | top-K 命中任一 gold 的 query 占比 |")
    lines.append(f"| mrr@{TOP_K} | {agg['mrr@k']:.3f} | 首个 gold 命中的平均倒数排名 |")
    lines.append("")
    lines.append("> context_precision / faithfulness / answer_relevancy 需 LLM 评判（RAGAS），")
    lines.append("> 未配置 LLM 时跳过；本基线为纯离线检索侧指标，后续每个阶段以此为对照报 Δ。")
    lines.append("")
    lines.append("## 逐条明细")
    lines.append("")
    lines.append("| query | gold | top-K 命中 | recall | rr |")
    lines.append("|-------|------|-----------|--------|----|")
    for q in per_query:
        hit_ids = [s for s in q["retrieved"] if s in set(q["gold"])]
        hit_str = ",".join(hit_ids) if hit_ids else ("ERROR" if q.get("error") else "—")
        lines.append(
            f"| {q['query']} | {','.join(q['gold'])} | {hit_str} | {q['recall']:.2f} | {q['rr']:.2f} |"
        )
    lines.append("")

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    if not os.path.exists(RUNS_PATH):
        raise SystemExit(
            f"找不到 {RUNS_PATH}\n请先运行：tsx eval/retrieve_cli.ts eval/dataset.jsonl > eval/retrieval_runs.jsonl"
        )
    rows = load_runs(RUNS_PATH)
    per_query = evaluate(rows)
    agg = aggregate(per_query)
    write_report(per_query, agg)

    print(f"n={agg['n']}  context_recall={agg['context_recall']:.3f}  "
          f"hit_rate@{TOP_K}={agg['hit_rate@k']:.3f}  mrr@{TOP_K}={agg['mrr@k']:.3f}")
    print(f"报告已写入 {REPORT_PATH}")


if __name__ == "__main__":
    main()

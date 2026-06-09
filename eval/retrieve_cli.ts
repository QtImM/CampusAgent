/**
 * Offline eval — retrieval runner (Node side).
 *
 * Reads an annotated dataset (JSONL) and runs every query through the real graph
 * retrieval pipeline (`retrieveEvidenceBundle` with debug trace), emitting one
 * JSONL line of trace per query to stdout. The Python metrics script consumes that
 * output, so the Node retrieval and the metric computation stay decoupled.
 *
 * Usage:  tsx eval/retrieve_cli.ts eval/dataset.jsonl > eval/retrieval_runs.jsonl
 *
 * Notes:
 * - Only the FAQ/local path is fully offline-deterministic (campus_faq.json is
 *   bundled). The vector KB path requires Supabase + network; when unavailable it
 *   degrades to empty/ILIKE and the run still completes.
 * - Memory is intentionally empty here (synthetic eval user) to avoid noise.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { retrieveEvidenceBundle } from '../services/agent/graph/retrieval';
import type { AgentGraphState } from '../services/agent/graph/types';

type DatasetRow = {
    query: string;
    expected_chunks: string[];
    gold_answer?: string;
};

const buildState = (query: string): AgentGraphState =>
    ({
        input: query,
        normalizedInput: query,
        // Zero-UUID: a well-formed id that matches no real user, so memory recall
        // returns empty without a Postgres type error.
        userId: '00000000-0000-0000-0000-000000000000',
        sessionId: '__eval__',
    } as unknown as AgentGraphState);

const main = async () => {
    const datasetPath = process.argv[2] || 'eval/dataset.jsonl';
    const lines = readFileSync(datasetPath, 'utf-8')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    for (const line of lines) {
        const row = JSON.parse(line) as DatasetRow;
        try {
            const bundle = await retrieveEvidenceBundle(buildState(row.query), { debug: true });
            const debug = bundle.debug!;
            process.stdout.write(
                JSON.stringify({
                    query: row.query,
                    expected_chunks: row.expected_chunks,
                    gold_answer: row.gold_answer,
                    rerank_provider: debug.rerankProvider,
                    path_counts: Object.fromEntries(
                        Object.entries(debug.perPath).map(([k, v]) => [k, v.length])
                    ),
                    fused_ids: debug.fused.map(c => c.sourceId),
                    final_ranked: debug.finalRanked.map(c => ({ sourceId: c.sourceId, sourceType: c.sourceType, score: c.score })),
                }) + '\n'
            );
        } catch (error) {
            process.stdout.write(
                JSON.stringify({
                    query: row.query,
                    expected_chunks: row.expected_chunks,
                    error: error instanceof Error ? error.message : String(error),
                    final_ranked: [],
                }) + '\n'
            );
        }
    }
};

main().catch(err => {
    console.error(err);
    process.exit(1);
});

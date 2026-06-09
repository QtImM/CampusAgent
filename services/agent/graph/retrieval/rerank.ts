import { AGENT_CONFIG } from '../../config';
import type { EvidenceItem } from '../types';

const trustWeight: Record<EvidenceItem['sourceType'], number> = {
    faq: 5,
    knowledge_base: 4,
    course_data: 4,
    session_state: 3,
    tool_prefetch: 3,
    memory: 1,
};

/**
 * Heuristic reranker (legacy / fallback).
 *
 * `score = trustWeight[sourceType] + topic.includes(query) + content.includes(query)`.
 * Kept as the tie-break / degradation path for when the cross-encoder reranker is
 * disabled or unreachable, consistent with the project's "runtime + fallback" design.
 */
export const rankEvidence = (query: string, evidence: EvidenceItem[]): EvidenceItem[] => {
    const normalized = query.toLowerCase();

    return evidence
        .map(item => {
            let score = trustWeight[item.sourceType] || 0;

            if (item.topic.toLowerCase().includes(normalized)) score += 5;
            if (item.contentSnippet.toLowerCase().includes(normalized)) score += 3;

            return {
                ...item,
                score,
            };
        })
        .sort((a, b) => b.score - a.score);
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

/** Score (query, document) pairs with Cohere Rerank. Returns indices→relevance. */
const rerankViaCohere = async (query: string, documents: string[]): Promise<number[]> => {
    const res = await fetchWithTimeout(
        'https://api.cohere.com/v1/rerank',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${AGENT_CONFIG.COHERE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: AGENT_CONFIG.COHERE_RERANK_MODEL,
                query,
                documents,
                top_n: documents.length,
            }),
        },
        AGENT_CONFIG.RERANKER_TIMEOUT_MS,
    );

    if (!res.ok) throw new Error(`Cohere rerank HTTP ${res.status}`);
    const json = (await res.json()) as { results: Array<{ index: number; relevance_score: number }> };
    const scores = new Array(documents.length).fill(0);
    json.results.forEach(r => {
        scores[r.index] = r.relevance_score;
    });
    return scores;
};

/** Score (query, document) pairs with a self-hosted bge-reranker-v2-m3 service. */
const rerankViaLocal = async (query: string, documents: string[]): Promise<number[]> => {
    const res = await fetchWithTimeout(
        AGENT_CONFIG.RERANKER_URL,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, documents }),
        },
        AGENT_CONFIG.RERANKER_TIMEOUT_MS,
    );

    if (!res.ok) throw new Error(`Local reranker HTTP ${res.status}`);
    const json = (await res.json()) as { scores: number[] };
    if (!Array.isArray(json.scores) || json.scores.length !== documents.length) {
        throw new Error('Local reranker returned malformed scores');
    }
    return json.scores;
};

const isCrossEncoderConfigured = (): boolean => {
    const provider = AGENT_CONFIG.RERANKER_PROVIDER;
    if (provider === 'cohere') return Boolean(AGENT_CONFIG.COHERE_API_KEY);
    if (provider === 'local') return Boolean(AGENT_CONFIG.RERANKER_URL);
    return false;
};

export type RerankOutcome = {
    evidence: EvidenceItem[];
    /** "cross-encoder:cohere" | "cross-encoder:local" | "heuristic" */
    provider: string;
};

/**
 * Two-stage rerank: a hybrid coarse-recall pool is scored pair-wise by a
 * cross-encoder, then truncated to top-K for the synthesizer.
 *
 * Falls back to the heuristic `rankEvidence` when the reranker is disabled,
 * unconfigured, or the call fails/times out — never leaves the pipeline without
 * an ordering.
 */
export const rerankWithCrossEncoder = async (
    query: string,
    evidence: EvidenceItem[],
    topK: number = AGENT_CONFIG.EVIDENCE_TOP_K,
): Promise<RerankOutcome> => {
    const heuristicFallback = (): RerankOutcome => ({
        evidence: rankEvidence(query, evidence).slice(0, topK),
        provider: 'heuristic',
    });

    if (!isCrossEncoderConfigured() || evidence.length === 0) {
        return heuristicFallback();
    }

    const documents = evidence.map(item => `${item.topic}\n${item.contentSnippet}`.trim());

    try {
        const provider = AGENT_CONFIG.RERANKER_PROVIDER;
        const scores = provider === 'cohere'
            ? await rerankViaCohere(query, documents)
            : await rerankViaLocal(query, documents);

        const reranked = evidence
            .map((item, index) => ({ ...item, score: scores[index] ?? 0 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

        return { evidence: reranked, provider: `cross-encoder:${provider}` };
    } catch (error) {
        console.warn('[rerank] cross-encoder unavailable, falling back to heuristic:', error);
        return heuristicFallback();
    }
};

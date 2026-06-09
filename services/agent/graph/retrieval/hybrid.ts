import { FAQService } from '../../../faq';
import { getAllUserFacts } from '../../memory';
import type { AgentGraphState, EvidenceItem } from '../types';
import { buildEvidenceItems } from './evidence';

/**
 * Reciprocal Rank Fusion.
 *
 * Merges several independently ranked candidate lists into one, scoring each
 * candidate by `Σ 1/(k + rank_i)` across the lists it appears in. RRF needs no
 * per-list weight tuning and is insensitive to the score scales of the different
 * recall paths (a cosine similarity and a keyword count are not comparable), which
 * is why it is the industry default for hybrid search.
 *
 * Candidates are de-duplicated by `${sourceType}:${sourceId}`. The returned items
 * carry the fused RRF score (replacing each path's local score).
 *
 * @param rankedLists each list already ordered best-first
 * @param k smoothing constant; 60 is the canonical value from the original RRF paper
 */
export const rrfFuse = (rankedLists: EvidenceItem[][], k = 60): EvidenceItem[] => {
    const fused = new Map<string, { item: EvidenceItem; score: number }>();

    for (const list of rankedLists) {
        list.forEach((item, index) => {
            const rank = index + 1;
            const contribution = 1 / (k + rank);
            const key = `${item.sourceType}:${item.sourceId}`;
            const existing = fused.get(key);
            if (existing) {
                existing.score += contribution;
            } else {
                fused.set(key, { item, score: contribution });
            }
        });
    }

    return Array.from(fused.values())
        .sort((a, b) => b.score - a.score)
        .map(entry => ({ ...entry.item, score: entry.score }));
};

export type HybridRecall = {
    /** RRF-fused candidate pool (vector + keyword paths), best-first. */
    fused: EvidenceItem[];
    /** Per-path candidates before fusion, for tracing/eval. */
    perPath: Record<string, EvidenceItem[]>;
    /** User-memory facts — appended downstream as low-trust evidence, not fused. */
    memory: EvidenceItem[];
};

const RECALL_DEPTH = 20;

/**
 * Hybrid recall: run the dense (vector) path and the sparse (keyword) path in
 * parallel, then fuse with RRF.
 *
 * - vector path  → `FAQService.searchKnowledgeBase` (Edge Function embedding +
 *   pgvector; degrades to ILIKE keyword search when the Edge Function is down).
 * - keyword path → `FAQService.searchFAQs` over the local structured FAQ store.
 *
 * `rrfFuse` is generic over N lists, so a dedicated Postgres BM25/tsvector keyword
 * path (data-side upgrade, short-board #2) slots in as a third list with no code
 * change here.
 */
export const hybridRetrieve = async (state: AgentGraphState, query: string): Promise<HybridRecall> => {
    const [knowledgeBase, localFaq, memoryFacts] = await Promise.all([
        FAQService.searchKnowledgeBase(query),
        Promise.resolve(FAQService.searchFAQs(query)),
        getAllUserFacts(state.userId),
    ]);

    const vectorItems = buildEvidenceItems('knowledge_base', knowledgeBase).slice(0, RECALL_DEPTH);
    const keywordItems = buildEvidenceItems('faq', localFaq).slice(0, RECALL_DEPTH);
    const memoryRows = Object.entries(memoryFacts).map(([key, value]) => ({ key, value }));
    const memoryItems = buildEvidenceItems('memory', memoryRows);

    const fused = rrfFuse([vectorItems, keywordItems]).slice(0, RECALL_DEPTH);

    return {
        fused,
        perPath: {
            vector: vectorItems,
            keyword: keywordItems,
        },
        memory: memoryItems,
    };
};

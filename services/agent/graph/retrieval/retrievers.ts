import { FAQService } from '../../../faq';
import { getAllUserFacts } from '../../memory';
import { AGENT_CONFIG } from '../../config';
import type { AgentGraphState, EvidenceItem, RetrievalDebug } from '../types';
import { buildEvidenceItems, toCandidates } from './evidence';
import { hybridRetrieve } from './hybrid';
import { normalizeGraphQuery } from './normalize_query';
import { rankEvidence, rerankWithCrossEncoder } from './rerank';

export type RetrieveOptions = {
    /** When true, attach a deep trace of every pipeline stage for the offline eval harness. */
    debug?: boolean;
};

export type EvidenceBundle = {
    normalized: ReturnType<typeof normalizeGraphQuery>;
    rawResults: Record<string, any[]>;
    evidence: EvidenceItem[];
    debug?: RetrievalDebug;
};

/** Legacy single-path bundle: keyword FAQ + vector KB + memory, heuristic rerank only. */
const legacyRetrieve = async (
    state: AgentGraphState,
    query: string,
    debug: boolean,
): Promise<EvidenceBundle> => {
    const normalized = normalizeGraphQuery(query);
    const localFaq = await Promise.resolve(FAQService.searchFAQs(normalized.query));
    const knowledgeBase = await FAQService.searchKnowledgeBase(normalized.query);
    const memoryFacts = await getAllUserFacts(state.userId);
    const memoryRows = Object.entries(memoryFacts).map(([key, value]) => ({ key, value }));

    const evidence = rankEvidence(normalized.query, [
        ...buildEvidenceItems('faq', localFaq),
        ...buildEvidenceItems('knowledge_base', knowledgeBase),
        ...buildEvidenceItems('memory', memoryRows),
    ]);

    const bundle: EvidenceBundle = {
        normalized,
        rawResults: { faq: localFaq, knowledge_base: knowledgeBase, memory: memoryRows },
        evidence,
    };

    if (debug) {
        bundle.debug = {
            query: normalized.query,
            perPath: { legacy: toCandidates(evidence) },
            fused: toCandidates(evidence),
            finalRanked: toCandidates(evidence.slice(0, AGENT_CONFIG.EVIDENCE_TOP_K)),
            rerankProvider: 'heuristic',
        };
    }

    return bundle;
};

/**
 * Retrieve and rank evidence for the graph's `retrieve_context` node.
 *
 * Pipeline (when HYBRID_SEARCH_ENABLED):
 *   hybridRetrieve (vector + keyword, RRF-fused top-20)
 *     → rerankWithCrossEncoder (cross-encoder top-K, heuristic fallback)
 *     → memory facts appended as low-trust tail.
 *
 * Falls back to the legacy single-path + heuristic flow when hybrid is disabled.
 */
export const retrieveEvidenceBundle = async (
    state: AgentGraphState,
    options: RetrieveOptions = {},
): Promise<EvidenceBundle> => {
    const debug = Boolean(options.debug);
    const normalized = normalizeGraphQuery(state.normalizedInput || state.input);

    if (!AGENT_CONFIG.HYBRID_SEARCH_ENABLED) {
        return legacyRetrieve(state, state.normalizedInput || state.input, debug);
    }

    const recall = await hybridRetrieve(state, normalized.query);
    const { evidence: rerankedTop, provider } = await rerankWithCrossEncoder(normalized.query, recall.fused);

    // Memory facts ride along as low-trust evidence; they are not part of the
    // ranked retrieval competition but remain available to the synthesizer.
    const evidence = [...rerankedTop, ...recall.memory];

    const bundle: EvidenceBundle = {
        normalized,
        rawResults: {
            vector: recall.perPath.vector,
            keyword: recall.perPath.keyword,
            memory: recall.memory,
        },
        evidence,
    };

    if (debug) {
        bundle.debug = {
            query: normalized.query,
            perPath: {
                vector: toCandidates(recall.perPath.vector),
                keyword: toCandidates(recall.perPath.keyword),
            },
            fused: toCandidates(recall.fused),
            finalRanked: toCandidates(rerankedTop),
            rerankProvider: provider,
        };
    }

    return bundle;
};

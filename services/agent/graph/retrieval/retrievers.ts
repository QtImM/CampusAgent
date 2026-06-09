import { FAQService } from '../../../faq';
import { getAllUserFacts } from '../../memory';
import type { AgentGraphState } from '../types';
import { buildEvidenceItems } from './evidence';
import { normalizeGraphQuery } from './normalize_query';
import { rankEvidence } from './rerank';

export const retrieveEvidenceBundle = async (state: AgentGraphState) => {
    const normalized = normalizeGraphQuery(state.normalizedInput || state.input);
    const localFaq = await Promise.resolve(FAQService.searchFAQs(normalized.query));
    const knowledgeBase = await FAQService.searchKnowledgeBase(normalized.query);
    const memoryFacts = await getAllUserFacts(state.userId);
    const memoryRows = Object.entries(memoryFacts).map(([key, value]) => ({ key, value }));

    const rawResults = {
        faq: localFaq,
        knowledge_base: knowledgeBase,
        memory: memoryRows,
    };

    const evidence = rankEvidence(normalized.query, [
        ...buildEvidenceItems('faq', localFaq),
        ...buildEvidenceItems('knowledge_base', knowledgeBase),
        ...buildEvidenceItems('memory', memoryRows),
    ]);

    return {
        normalized,
        rawResults,
        evidence,
    };
};

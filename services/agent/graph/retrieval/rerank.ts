import type { EvidenceItem } from '../types';

const trustWeight: Record<EvidenceItem['sourceType'], number> = {
    faq: 5,
    knowledge_base: 4,
    course_data: 4,
    session_state: 3,
    tool_prefetch: 3,
    memory: 1,
};

export const rankEvidence = (query: string, evidence: EvidenceItem[]) => {
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

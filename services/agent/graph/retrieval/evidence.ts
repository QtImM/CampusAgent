import type { EvidenceItem, EvidenceSourceType, RetrievalCandidate } from '../types';

/** Tiny stable string hash (djb2) for deriving fallback chunk ids from content. */
const djb2 = (value: string): string => {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
};

/**
 * Derive a stable identifier for an evidence row so the offline eval harness can
 * align retrieved chunks against gold labels. FAQ rows carry a real `id`; knowledge
 * base chunks fall back to their metadata key (or a content hash) since the Edge
 * Function does not return a primary key; memory rows use their fact key.
 */
export const deriveSourceId = (
    sourceType: EvidenceSourceType,
    row: any,
    index: number
): string => {
    if (row?.id) return String(row.id);
    if (sourceType === 'memory' && row?.key) return `memory:${row.key}`;
    if (sourceType === 'knowledge_base') {
        const meta = row?.metadata || {};
        const key = meta.source || meta.title || meta.h2;
        if (key) return `kb:${key}${meta.h3 ? `#${meta.h3}` : ''}`;
        if (row?.content) return `kb:${djb2(String(row.content))}`;
    }
    return `${sourceType}-${index}`;
};

export const buildEvidenceItems = (
    sourceType: EvidenceSourceType,
    rows: any[]
): EvidenceItem[] => {
    const now = new Date().toISOString();

    return rows.map((row, index) => ({
        id: `${sourceType}-${index}`,
        sourceId: deriveSourceId(sourceType, row, index),
        sourceType,
        topic: row.question_zh || row.title || row.metadata?.h2 || row.key || 'unknown topic',
        title: row.question_zh || row.title || row.key || 'Untitled',
        contentSnippet: row.answer_zh || row.content || row.value || '',
        fullContentRef: row.url || row.id || undefined,
        metadata: row.metadata || undefined,
        score: 0,
        supportsAction: sourceType === 'course_data' || sourceType === 'session_state',
        retrievedAt: now,
    }));
};

/** Project ranked evidence into lightweight trace candidates. */
export const toCandidates = (evidence: EvidenceItem[]): RetrievalCandidate[] =>
    evidence.map((item, index) => ({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        topic: item.topic,
        score: item.score,
        rank: index + 1,
    }));

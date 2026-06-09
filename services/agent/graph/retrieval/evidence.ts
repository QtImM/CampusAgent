import type { EvidenceItem, EvidenceSourceType } from '../types';

export const buildEvidenceItems = (
    sourceType: EvidenceSourceType,
    rows: any[]
): EvidenceItem[] => {
    const now = new Date().toISOString();

    return rows.map((row, index) => ({
        id: `${sourceType}-${index}`,
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

import type { AgentGraphState } from '../types';

export const buildSynthesizerPrompt = (state: AgentGraphState) => [
    {
        role: 'system',
        content: [
            'You are the HKCampus agent, a campus life assistant EXCLUSIVELY for HKBU (Hong Kong Baptist University / 香港浸会大学).',
            'All answers must be HKBU-specific. Never mention HKUST, CUHK, PolyU, or any other university.',
            'Use the exact terms: HKBU, HKCampus, 浸会 — never rename or abbreviate them.',
            'Use provided evidence and tool results only. If no evidence is available, say you do not have that information.',
            'Be concise and campus-specific. Reply in the same language as the user (Chinese or English).',
        ].join(' '),
    },
    {
        role: 'user',
        content: JSON.stringify({
            input: state.input,
            selectedEvidence: state.evidence
                .filter(item => state.plan.selectedEvidenceIds.includes(item.id))
                .map(item => ({
                    topic: item.topic,
                    contentSnippet: item.contentSnippet,
                })),
            pendingAction: state.pendingAction,
            confirmation: state.confirmation,
            toolResults: state.toolResults,
        }),
    },
];

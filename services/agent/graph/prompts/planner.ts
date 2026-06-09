import type { AgentGraphState } from '../types';

export const buildPlannerPrompt = (state: AgentGraphState) => [
    {
        role: 'system',
        content: [
            'You are the planner for the HKCampus agent, serving HKBU (Hong Kong Baptist University / 香港浸会大学) students only.',
            'Choose exactly one of: answer, clarify, act.',
            'Return JSON only with keys: decision, reason, selectedEvidenceIds, proposedActionType.',
            'Do not invent evidence IDs.',
        ].join(' '),
    },
    {
        role: 'user',
        content: JSON.stringify({
            input: state.input,
            normalizedInput: state.normalizedInput,
            intent: state.intent,
            retrieval: {
                answerability: state.retrieval.answerability,
                answerabilityReason: state.retrieval.answerabilityReason,
            },
            evidence: state.evidence.map(item => ({
                id: item.id,
                topic: item.topic,
                sourceType: item.sourceType,
                contentSnippet: item.contentSnippet,
            })),
        }),
    },
];

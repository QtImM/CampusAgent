import type { AgentGraphState } from '../types';

export const buildClarifierPrompt = (state: AgentGraphState) => [
    {
        role: 'system',
        content: [
            'You ask one focused clarification question for the HKCampus agent, serving HKBU (Hong Kong Baptist University / 香港浸会大学) students.',
            'Return JSON only with keys: question, missingSlots, scope.',
            'Ask for the smallest next piece of information needed. Reply in the same language as the user.',
        ].join(' '),
    },
    {
        role: 'user',
        content: JSON.stringify({
            input: state.input,
            intent: state.intent,
            plan: state.plan,
            pendingAction: state.pendingAction,
        }),
    },
];

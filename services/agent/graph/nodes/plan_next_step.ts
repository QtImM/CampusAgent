import { callDeepSeek, resolveModelName } from '../../llm';
import type { AgentGraphState } from '../types';
import { pushTrace } from '../telemetry';
import { buildPlannerPrompt } from '../prompts/planner';

export const planNextStepNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    try {
        const raw = await callDeepSeek(buildPlannerPrompt(state), {
            model: resolveModelName('fast'),
        });
        const parsed = JSON.parse(raw);

        return pushTrace(
            {
                ...state,
                plan: {
                    decision: parsed.decision,
                    reason: parsed.reason,
                    selectedEvidenceIds: parsed.selectedEvidenceIds || [],
                    proposedActionType: parsed.proposedActionType,
                },
            },
            'plan_next_step',
            `decision=${parsed.decision}`
        );
    } catch (error) {
        console.error('[planNextStepNode] LLM call failed, falling back to answer:', error);
        return pushTrace(
            {
                ...state,
                plan: {
                    decision: 'answer',
                    reason: `planner error fallback: ${String(error)}`,
                    selectedEvidenceIds: state.evidence.map(e => e.id),
                },
            },
            'plan_next_step',
            `error_fallback`
        );
    }
};

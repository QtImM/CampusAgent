import { callDeepSeek, resolveModelName } from '../../llm';
import type { AgentGraphState } from '../types';
import { pushTraceWithDuration, startTraceTimer } from '../telemetry';
import { buildClarifierPrompt } from '../prompts/clarifier';

export const clarifyUserNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    console.log('[clarifyUserNode] called');
    const model = resolveModelName('fast');
    const timer = startTraceTimer();
    let latencyMs: number | undefined;

    try {
        const raw = await callDeepSeek(buildClarifierPrompt(state), { model });
        latencyMs = timer.getDuration();
        const parsed = JSON.parse(raw);

        return pushTraceWithDuration(
            {
                ...state,
                clarification: {
                    needed: true,
                    question: parsed.question,
                    missingSlots: parsed.missingSlots || [],
                    scope: parsed.scope,
                },
            },
            'clarify_user',
            parsed.question,
            timer.startedAt,
            {
                checkpoint: 'clarification',
                llmCalls: [{ model, success: true, latencyMs }],
            }
        );
    } catch (error) {
        throw error;
    }
};

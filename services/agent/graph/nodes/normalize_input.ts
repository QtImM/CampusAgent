import type { AgentGraphState } from '../types';
import { pushTrace } from '../telemetry';
import { normalizeGraphQuery } from '../retrieval';

export const normalizeInputNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    const normalized = normalizeGraphQuery(state.input);

    return pushTrace(
        {
            ...state,
            normalizedInput: normalized.query,
        },
        'normalize_input',
        `normalized=${normalized.query}`
    );
};

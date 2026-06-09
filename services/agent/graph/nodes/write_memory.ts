import { getAllUserFacts } from '../../memory';
import {
    extractMemoryCandidatesFromConversation,
    filterMemoryCandidates,
} from '../../memory_extractor';
import { writeMemoryFactTool } from '../tools/memory_tools';
import type { AgentGraphState } from '../types';
import { pushTrace } from '../telemetry';

export const writeMemoryNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    try {
        const existingFacts = await getAllUserFacts(state.userId);
        const candidates = await extractMemoryCandidatesFromConversation({
            recentTurns: state.history.slice(-3),
        });
        const accepted = filterMemoryCandidates(candidates, existingFacts);

        for (const memory of accepted) {
            await writeMemoryFactTool(state.userId, memory.key, memory.value);
        }

        return pushTrace(
            {
                ...state,
                memoryCandidates: candidates,
            },
            'write_memory',
            `accepted=${accepted.length}`
        );
    } catch (error) {
        return pushTrace(
            {
                ...state,
                errors: [...state.errors, `write_memory:${String(error)}`],
            },
            'write_memory',
            'skipped after error'
        );
    }
};

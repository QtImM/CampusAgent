import type { GraphEntryInput, GraphRunResult } from './graph/types';
import { createAgentGraphRuntime } from './graph';

export const runAgentGraph = async (input: GraphEntryInput): Promise<GraphRunResult> => {
    const runtime = createAgentGraphRuntime();
    return runtime.run(input);
};

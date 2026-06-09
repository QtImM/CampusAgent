import type { AgentGraphState, GraphTraceEntry } from './types';

type TraceMetadata = {
    branch?: string;
    llmCalls?: GraphTraceEntry['llmCalls'];
    toolCalls?: GraphTraceEntry['toolCalls'];
    checkpoint?: GraphTraceEntry['checkpoint'];
    startedAt?: string;
};

export const startTraceTimer = (): { startedAt: string; getDuration: () => number } => {
    const start = Date.now();
    return {
        startedAt: new Date(start).toISOString(),
        getDuration: () => Date.now() - start,
    };
};

export const pushTrace = (
    state: AgentGraphState,
    node: string,
    summary: string,
    metadata?: TraceMetadata
): AgentGraphState => {
    const startedAt = metadata?.startedAt ?? new Date().toISOString();
    const entry: GraphTraceEntry = {
        node,
        summary,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: new Date().getTime() - new Date(startedAt).getTime(),
        ...metadata,
    };
    return {
        ...state,
        trace: [...state.trace, entry],
    };
};

export const pushTraceWithDuration = (
    state: AgentGraphState,
    node: string,
    summary: string,
    startedAt: string,
    metadata?: TraceMetadata
): AgentGraphState => {
    const entry: GraphTraceEntry = {
        node,
        summary,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: new Date().getTime() - new Date(startedAt).getTime(),
        ...metadata,
    };
    return {
        ...state,
        trace: [...state.trace, entry],
    };
};

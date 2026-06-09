import type {
    AgentGeoPoint,
    AgentHistoryItem,
    AgentResponse,
    AgentSessionState,
    AgentStep,
    MemoryCandidate,
    PendingAction,
} from '../types';

export type { PendingAction };

export type GraphIntentKind = 'unknown' | 'qa' | 'action' | 'hybrid' | 'unsupported';
export type GraphDomain =
    | 'faq'
    | 'course_community'
    | 'schedule'
    | 'calendar'
    | 'campus'
    | 'memory'
    | 'mixed'
    | 'unknown';

export type EvidenceSourceType =
    | 'faq'
    | 'knowledge_base'
    | 'memory'
    | 'session_state'
    | 'course_data'
    | 'tool_prefetch';

export type PlannerDecision = 'answer' | 'clarify' | 'act';

export type EvidenceItem = {
    id: string;
    sourceType: EvidenceSourceType;
    topic: string;
    title: string;
    contentSnippet: string;
    fullContentRef?: string;
    metadata?: Record<string, any>;
    score: number;
    supportsAction: boolean;
    retrievedAt: string;
};

export type GraphIntentState = {
    kind: GraphIntentKind;
    domain: GraphDomain;
    requiresRetrieval: boolean;
    requiresActionPreparation: boolean;
    requiresConfirmation: boolean;
    confidence: number;
    reason: string;
};

export type GraphRetrievalState = {
    query: string;
    expandedQueries: string[];
    sourcesRequested: Array<'faq' | 'knowledge_base' | 'memory' | 'session_context' | 'course_context'>;
    rawResults: Record<string, any[]>;
    rankedEvidence: EvidenceItem[];
    answerability: 'unknown' | 'sufficient' | 'insufficient' | 'ambiguous';
    answerabilityReason: string;
};

export type GraphPlanState = {
    decision: PlannerDecision;
    reason: string;
    selectedEvidenceIds: string[];
    proposedActionType?: PendingAction['type'];
};

export type ClarificationState = {
    needed: boolean;
    question?: string;
    missingSlots: string[];
    scope?: 'intent' | 'action_parameters' | 'confirmation' | 'retrieval_disambiguation';
};

export type PreparedToolCall = {
    toolName: string;
    input: Record<string, any>;
};

export type ToolExecutionResult = {
    toolName: string;
    success: boolean;
    resultSummary: string;
    rawResult: any;
    userVisibleData?: Record<string, any>;
    retryable: boolean;
};

export type GraphTraceEntry = {
    node: string;
    summary: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    branch?: string;
    llmCalls?: Array<{ model: string; success: boolean; latencyMs?: number }>;
    toolCalls?: Array<{ toolName: string; success: boolean; retryable: boolean }>;
    checkpoint?: 'clarification' | 'confirmation' | 'cancelled' | 'completed';
};

export type AgentGraphState = {
    input: string;
    normalizedInput: string;
    sessionId: string;
    userId: string;
    history: AgentHistoryItem[];
    historySummary?: string;
    sessionState: AgentSessionState;
    deviceLocation?: AgentGeoPoint | null;
    intent: GraphIntentState;
    retrieval: GraphRetrievalState;
    evidence: EvidenceItem[];
    plan: GraphPlanState;
    clarification: ClarificationState;
    pendingAction: PendingAction | null;
    confirmation: {
        required: boolean;
        satisfied: boolean;
        cancelled?: boolean;
        updatedPendingAction?: PendingAction | null;
        prompt?: string;
    };
    toolCalls: PreparedToolCall[];
    toolResults: ToolExecutionResult[];
    finalResponse?: string;
    memoryCandidates: MemoryCandidate[];
    steps: AgentStep[];
    trace: GraphTraceEntry[];
    errors: string[];
};

export type GraphEntryInput = {
    input: string;
    userId: string;
    sessionId: string;
    history: AgentHistoryItem[];
    historySummary?: string;
    sessionState: AgentSessionState;
    deviceLocation?: AgentGeoPoint | null;
};

export type GraphRunResult = {
    response: AgentResponse;
    sessionState: AgentSessionState;
    finalState: AgentGraphState;
};

export type GraphRuntime = {
    run(input: GraphEntryInput): Promise<GraphRunResult>;
};

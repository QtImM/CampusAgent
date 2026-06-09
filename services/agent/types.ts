export type ToolParameter = {
    type: 'string' | 'number' | 'boolean' | 'object';
    description: string;
    enum?: string[];
    required?: boolean;
};

export type ToolDefinition = {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, ToolParameter>;
        required: string[];
    };
};

export type AgentStep = {
    thought?: string;
    reply?: string;
    modelTier?: 'fast' | 'reasoning';
    modelName?: string;
    routeReason?: string;
    path?: 'pending' | 'stable_task' | 'local_rule' | 'intent_route' | 'cache' | 'llm' | 'prefetch';
    action?: {
        tool: string;
        input: any;
    };
    observation?: string;
    quickReplies?: string[];
};

export type AgentResponse = {
    steps: AgentStep[];
    finalAnswer?: string;
    quickReplies?: string[];
    actionPayload?: import('./action_runtime/types').ActionPayload | null;
    debug?: {
        trace: Array<Record<string, any>>;
    };
};

export type AgentHistoryItem = {
    role: 'user' | 'assistant' | 'tool';
    content: string;
};

export type PendingAction =
    | {
        type: 'post_course_review';
        params: { courseCode?: string; rating?: number; content?: string };
        missingRequiredFields: string[];
        userVisibleSummary: string;
        safeToExecute: boolean;
    }
    | {
        type: 'post_course_teaming';
        params: { courseCode?: string; section?: string; content?: string };
        missingRequiredFields: string[];
        userVisibleSummary: string;
        safeToExecute: boolean;
    }
    | {
        type: 'send_course_chat_message';
        params: { courseCode?: string; content?: string };
        missingRequiredFields: string[];
        userVisibleSummary: string;
        safeToExecute: boolean;
    }
    | {
        type: 'write_user_schedule_entry';
        params: {
            title?: string;
            dayOfWeek?: number;
            courseCode?: string;
            startTime?: string;
            endTime?: string;
            startPeriod?: number;
            endPeriod?: number;
            room?: string;
            weekText?: string;
        };
        missingRequiredFields: string[];
        userVisibleSummary: string;
        safeToExecute: boolean;
    }
    | {
        type: 'create_user_calendar_event';
        params: {
            title?: string;
            eventType?: 'exam' | 'quiz' | 'assignment' | 'custom';
            eventDate?: string;
            courseCode?: string;
            startTime?: string;
            endTime?: string;
            location?: string;
            note?: string;
        };
        missingRequiredFields: string[];
        userVisibleSummary: string;
        safeToExecute: boolean;
    };

export type AgentSessionState = {
    goal?: string;
    activeTask?: string;
    facts: Record<string, string>;
    recentDecisions: string[];
    openLoops: string[];
    referencedCourse?: string;
    referencedBuilding?: string;
    summary?: string;
    pendingAction?: PendingAction | null;
    pendingDraft?: import('./action_runtime/types').PendingDraft | null;
};

export type MemoryCandidateType =
    | 'long_term_preference'
    | 'background_fact'
    | 'emotion'
    | 'temporary_context'
    | 'unknown';

export type MemoryCandidateBase = {
    should_store: boolean;
    key: string;
    value: string;
    confidence: number;
    reason: string;
};

export type MemoryCandidate = MemoryCandidateBase & {
    memory_type: MemoryCandidateType;
};

export type DurableMemoryType = Exclude<
    MemoryCandidateType,
    'emotion' | 'temporary_context' | 'unknown'
>;

export type AcceptedMemoryWrite = {
    memoryType: DurableMemoryType;
} & MemoryCandidateBase;

export interface AgentGeoPoint {
    latitude: number;
    longitude: number;
}

export interface AgentContext {
    userId: string;
    sessionId: string;
    history: AgentHistoryItem[];
    historySummary?: string;
    sessionState: AgentSessionState;
    deviceLocation?: AgentGeoPoint | null;
}

export type AgentRuntimeResponse = AgentResponse;

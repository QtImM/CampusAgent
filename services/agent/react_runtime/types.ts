import { AgentGeoPoint, AgentHistoryItem, AgentSessionState } from '../types';

// ─── Tool Schema (OpenAI function calling format) ───────────────────────────

export type ToolSchema = {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, {
                type: string;
                description: string;
                enum?: string[];
            }>;
            required: string[];
        };
    };
};

// ─── Tool Execution Result ──────────────────────────────────────────────────

export type ToolResult = {
    success: boolean;
    data?: any;
    error?: string;
    summary: string;
};

// ─── DeepSeek Message Types ─────────────────────────────────────────────────

export type ChatMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    reasoning_content?: string | null;
    tool_calls?: ToolCall[] | null;
    tool_call_id?: string;
};

export type ToolCall = {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
};

export type DeepSeekChoice = {
    message: {
        role: 'assistant';
        content: string | null;
        reasoning_content?: string | null;
        tool_calls?: ToolCall[] | null;
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
};

export type DeepSeekResponse = {
    choices: DeepSeekChoice[];
};

// ─── ReAct Loop State ───────────────────────────────────────────────────────

export type ReactLoopState = {
    messages: ChatMessage[];
    iteration: number;
    done: boolean;
    finalAnswer: string | null;
    toolsUsed: string[];
    error?: string;
};

// ─── ReAct Loop Result ──────────────────────────────────────────────────────

export type ReactLoopResult = {
    finalAnswer: string;
    iterations: number;
    toolsUsed: string[];
    error?: string;
};

// ─── ReAct Agent Input ──────────────────────────────────────────────────────

export type ReactAgentInput = {
    input: string;
    userId: string;
    sessionId: string;
    history: AgentHistoryItem[];
    historySummary?: string;
    sessionState: AgentSessionState;
    deviceLocation?: AgentGeoPoint | null;
};

// ─── ReAct Agent Result ─────────────────────────────────────────────────────

export type ReactAgentResult = {
    finalAnswer: string;
    iterations: number;
    toolsUsed: string[];
    error?: string;
};

// ─── Tool Execution Context ─────────────────────────────────────────────────

export type ToolExecutionContext = {
    userId: string;
    deviceLocation?: AgentGeoPoint | null;
    sessionState: AgentSessionState;
};

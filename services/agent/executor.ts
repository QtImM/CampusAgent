import { createInitialSessionState, updateSessionStateWithTurn } from './session_state';
import { AGENT_CONFIG } from './config';
import { summarizeHistory } from './summarizer';
import { callDeepSeek, resolveModelName } from './llm';
import { AgentContext, AgentGeoPoint, AgentResponse } from './types';
import { runActionAgent, detectActionType, executeToolCall } from './action_runtime';
import type { PendingDraft } from './action_runtime';
import { runReactAgent } from './react_runtime';
import { runAgentGraph } from './index';
import { extractMemoryCandidatesFromConversation, filterMemoryCandidates } from './memory_extractor';
import { saveMemoryFact, getAllUserFacts } from './memory';

/**
 * Thin adapter that owns entrypoint wiring and conversation context assembly.
 *
 * Primary path: the LangGraph runtime (services/agent/graph) handles intent
 * routing, retrieval, planning, tool execution, confirmation flow and memory.
 * Write operations are still routed to the Action Agent runtime when
 * ACTION_AGENT_ENABLED. If the graph throws, we degrade to the ReAct loop and
 * finally a plain fallback LLM call.
 */
export class AgentExecutor {
    private context: AgentContext;
    private static readonly MAX_HISTORY_ITEMS = 12;
    private static readonly MAX_RECENT_HISTORY_ITEMS = 6;
    private static graphImportFailed = false;

    constructor(userId: string) {
        this.context = {
            userId,
            sessionId: `session_${Date.now()}`,
            history: [],
            historySummary: '',
            sessionState: createInitialSessionState(),
            deviceLocation: null,
        };
    }

    setDeviceLocation(location: AgentGeoPoint | null) {
        this.context.deviceLocation = location;
    }

    async process(prompt: string, onUpdate?: (text: string) => void): Promise<AgentResponse> {
        const response = await this.processWithGraph(prompt, onUpdate);
        return response;
    }

    async processWithGraph(prompt: string, onUpdate?: (text: string) => void): Promise<AgentResponse> {
        this.pushHistory('user', prompt);

        let response: AgentResponse;

        // ─── Route to Action Agent for write operations ─────────────
        const useAction = this.shouldUseActionAgent(prompt);
        if (useAction) {
            try {
                response = await this.processWithActionAgent(prompt);
            } catch (error) {
                console.error('[AgentExecutor] Action Agent failed, falling back to React loop:', error);
                response = await this.processWithReactLoop(prompt, onUpdate);
            }
        } else {
            response = await this.processWithGraphRuntime(prompt, onUpdate);
        }

        if (!response.finalAnswer) {
            console.warn('[AgentExecutor] finalAnswer is empty/undefined, response:', JSON.stringify(response).slice(0, 200));
            response.finalAnswer = '抱歉，我暂时无法生成回复，请稍后再试。';
        }

        this.pushHistory('assistant', response.finalAnswer);
        if (onUpdate) onUpdate(response.finalAnswer);

        // Fire-and-forget: extract and persist memory from this turn
        this.extractAndPersistMemory().catch((err) => {
            console.warn('[AgentExecutor] Memory extraction failed (non-blocking):', err);
        });

        return response;
    }

    /**
     * Extract durable memory facts from the recent conversation and persist to Supabase.
     * Runs asynchronously after each turn without blocking the response.
     */
    private async extractAndPersistMemory(): Promise<void> {
        if (!AGENT_CONFIG.DEEPSEEK_ENABLED) return;

        const recentTurns = this.context.history.slice(-4);
        if (recentTurns.length < 2) return;

        const candidates = await extractMemoryCandidatesFromConversation({ recentTurns });
        if (candidates.length === 0) return;

        const existingFacts = await getAllUserFacts(this.context.userId);
        const accepted = filterMemoryCandidates(candidates, existingFacts);

        for (const item of accepted) {
            await saveMemoryFact(this.context.userId, item.key, item.value);
            // Also update local session state so subsequent turns see the new fact
            this.context.sessionState.facts[item.key] = item.value;
        }

        if (accepted.length > 0) {
            console.log(`[AgentExecutor] Persisted ${accepted.length} memory fact(s):`, accepted.map(a => a.key));
        }
    }

    /**
     * Determine if the input should be routed to the Action Agent.
     * All detected write operations must route to the Action Agent
     * because the legacy graph path is no longer used.
     */
    private shouldUseActionAgent(prompt: string): boolean {
        if (!AGENT_CONFIG.ACTION_AGENT_ENABLED) {
            return false;
        }

        // If there's a pending draft, always use Action Agent for follow-ups
        if (this.context.sessionState.pendingDraft) {
            return true;
        }

        const actionType = detectActionType(prompt);
        return actionType !== null || this.isImplicitReviewFollowup(prompt);
    }

    private isImplicitReviewFollowup(prompt: string): boolean {
        const trimmed = prompt.trim();
        if (!this.context.sessionState.referencedCourse) {
            return false;
        }

        return /^(评价|評價|review|写评价|寫評價|发评价|發評價)$|^(我要|我想|帮我|幫我).*(评价|評價|review)$/i.test(trimmed);
    }

    /**
     * Process input through the Action Agent runtime.
     */
    private async processWithActionAgent(prompt: string): Promise<AgentResponse> {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const result = await runActionAgent({
            input: prompt,
            userId: this.context.userId,
            sessionId: this.context.sessionId,
            requestId,
            pendingDraft: this.context.sessionState.pendingDraft ?? null,
            history: this.context.history,
            sessionState: this.context.sessionState,
        }, executeToolCall);

        // Update session state with the new pending draft
        this.context.sessionState = {
            ...this.context.sessionState,
            pendingDraft: result.pendingDraft,
        };

        return {
            finalAnswer: result.finalAnswer,
            steps: [{
                thought: `action_agent: ${result.actionPayload?.action.phase || 'unknown'}`,
                path: 'llm',
            }],
            actionPayload: result.actionPayload,
        };
    }

    /**
     * Primary path: run the full LangGraph pipeline (normalize → route_intent →
     * retrieve_context → plan → clarify/prepare/confirm/execute → synthesize →
     * write_memory). On any failure, degrade to the ReAct loop.
     */
    private async processWithGraphRuntime(prompt: string, onUpdate?: (text: string) => void): Promise<AgentResponse> {
        try {
            // `input` is the current turn; `history` carries only prior turns.
            const priorHistory = this.context.history.slice(0, -1);
            const result = await runAgentGraph({
                input: prompt,
                userId: this.context.userId,
                sessionId: this.context.sessionId,
                history: priorHistory,
                historySummary: this.context.historySummary,
                sessionState: this.context.sessionState,
                deviceLocation: this.context.deviceLocation,
            });

            // Carry the graph's updated session state (pendingAction, facts, etc.)
            // back into the executor context for subsequent turns.
            this.context.sessionState = result.sessionState;

            if (!result.response.finalAnswer) {
                throw new Error('graph produced empty finalAnswer');
            }

            return result.response;
        } catch (error) {
            console.error('[AgentExecutor] LangGraph runtime failed, falling back to ReAct loop:', error);
            AgentExecutor.graphImportFailed = true;
            return this.processWithReactLoop(prompt, onUpdate);
        }
    }

    /**
     * Process input through the ReAct runtime.
     * Falls back to fallback LLM if REACT_RUNTIME_ENABLED is false or runtime fails.
     */
    private async processWithReactLoop(prompt: string, onUpdate?: (text: string) => void): Promise<AgentResponse> {
        if (!AGENT_CONFIG.REACT_RUNTIME_ENABLED) {
            return this.processWithFallbackLLM(prompt, onUpdate);
        }

        try {
            const result = await runReactAgent({
                input: prompt,
                userId: this.context.userId,
                sessionId: this.context.sessionId,
                history: this.context.history,
                historySummary: this.context.historySummary,
                sessionState: this.context.sessionState,
                deviceLocation: this.context.deviceLocation,
            });

            return {
                finalAnswer: result.finalAnswer,
                steps: [{
                    thought: result.error
                        ? `react: ${result.error}`
                        : `react: ${result.iterations} iterations, tools: [${result.toolsUsed.join(', ')}]`,
                    path: 'llm',
                }],
            };
        } catch (error) {
            console.error('[AgentExecutor] ReAct runtime failed, falling back to lightweight chat mode:', error);
            return this.processWithFallbackLLM(prompt, onUpdate);
        }
    }

    private pushHistory(role: 'user' | 'assistant' | 'tool', content: string) {
        const item = { role, content } as const;
        this.context.history.push(item);
        this.context.sessionState = updateSessionStateWithTurn(this.context.sessionState, item);
        if (this.context.history.length > AgentExecutor.MAX_HISTORY_ITEMS) {
            const summarized = summarizeHistory(this.context.history, {
                keepRecent: AgentExecutor.MAX_RECENT_HISTORY_ITEMS,
            });
            this.context.historySummary = [this.context.historySummary, summarized.summary].filter(Boolean).join('\n');
            this.context.sessionState.summary = this.context.historySummary;
            this.context.history = summarized.recentHistory;
        }
    }

    private async processWithFallbackLLM(prompt: string, onUpdate?: (text: string) => void): Promise<AgentResponse> {
        const modelName = resolveModelName('fast');
        const locationHint = this.context.deviceLocation
            ? `Current user location: ${this.context.deviceLocation.latitude}, ${this.context.deviceLocation.longitude}`
            : 'Current user location: unavailable';

        const messages = [
            {
                role: 'system',
                content: [
                    'You are the HKCampus agent for HKBU students.',
                    'Answer in concise Chinese unless the user clearly writes in English.',
                    'You are running in fallback mode because the advanced graph runtime is unavailable in this build.',
                    'Do not mention internal errors unless the user asks.',
                    'If a question requires private user data or a database action that you cannot safely perform, say so clearly and ask the user to try again later.',
                    locationHint,
                    this.context.historySummary ? `Conversation summary:\n${this.context.historySummary}` : '',
                ].filter(Boolean).join('\n\n'),
            },
            ...this.context.history.slice(-6).map((item) => ({
                role: item.role === 'assistant' ? 'assistant' : 'user',
                content: item.content,
            })),
        ];

        const finalAnswer = await callDeepSeek(messages, { model: modelName });

        return {
            finalAnswer,
            steps: [
                {
                    thought: AgentExecutor.graphImportFailed
                        ? 'Graph runtime unavailable, used fallback LLM mode'
                        : 'Used fallback LLM mode',
                    modelName,
                    path: 'llm',
                },
            ],
        };
    }
}

import { ReactAgentInput, ReactAgentResult, ChatMessage, ToolExecutionContext } from './types';
import { REACT_TOOL_SCHEMAS } from './tools';
import { buildReactSystemPrompt } from './prompts';
import { reactLoop } from './loop';

export async function runReactAgent(input: ReactAgentInput): Promise<ReactAgentResult> {
    const { input: userMessage, userId, history, historySummary, sessionState, deviceLocation } = input;

    const context: ToolExecutionContext = {
        userId,
        deviceLocation,
        sessionState,
    };

    const systemPrompt = buildReactSystemPrompt(context);

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
    ];

    const recentHistory = history
        .slice(-6)
        .filter((item, index, items) => !(
            index === items.length - 1 &&
            item.role === 'user' &&
            item.content === userMessage
        ));
    for (const item of recentHistory) {
        messages.push({
            role: item.role === 'tool' ? 'user' : item.role,
            content: item.content,
        });
    }

    messages.push({ role: 'user', content: userMessage });

    const result = await reactLoop(messages, REACT_TOOL_SCHEMAS, context);

    return {
        finalAnswer: result.finalAnswer,
        iterations: result.iterations,
        toolsUsed: result.toolsUsed,
        error: result.error,
    };
}

export type { ReactAgentInput, ReactAgentResult } from './types';

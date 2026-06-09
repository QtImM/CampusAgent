import { AGENT_CONFIG } from '../config';
import { callDeepSeekWithTools } from '../llm';
import { ChatMessage, ReactLoopResult, ToolExecutionContext, ToolSchema } from './types';
import { executeReactTool, REACT_TOOL_SCHEMAS } from './tools';

const MAX_ITERATIONS = AGENT_CONFIG.REACT_MAX_ITERATIONS;
const TIMEOUT_MS = AGENT_CONFIG.REACT_TIMEOUT_MS;

export async function reactLoop(
    messages: ChatMessage[],
    tools: ToolSchema[],
    context: ToolExecutionContext
): Promise<ReactLoopResult> {
    const toolsUsed: string[] = [];
    let iteration = 0;

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('React loop timeout')), TIMEOUT_MS);
    });

    try {
        return await Promise.race([
            runLoop(messages, tools, context, toolsUsed),
            timeoutPromise,
        ]);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[ReactLoop] Error:', error);

        if (errorMessage.includes('timeout')) {
            return {
                finalAnswer: '抱歉，请求超时，请稍后再试。',
                iterations: iteration,
                toolsUsed,
                error: 'timeout',
            };
        }

        return {
            finalAnswer: '抱歉，我暂时无法处理你的请求，请稍后再试。',
            iterations: iteration,
            toolsUsed,
            error: errorMessage,
        };
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

async function runLoop(
    initialMessages: ChatMessage[],
    tools: ToolSchema[],
    context: ToolExecutionContext,
    toolsUsed: string[]
): Promise<ReactLoopResult> {
    const messages = [...initialMessages];
    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
        const response = await callDeepSeekWithTools(messages, tools);

        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: response.content,
            reasoning_content: response.reasoning_content ?? null,
            tool_calls: response.tool_calls || null,
        };
        messages.push(assistantMessage);

        if (!response.tool_calls || response.tool_calls.length === 0) {
            return {
                finalAnswer: response.content || '抱歉，我暂时无法生成回复。',
                iterations: iteration,
                toolsUsed,
            };
        }

        for (const toolCall of response.tool_calls) {
            const toolName = toolCall.function.name;
            let args: Record<string, any> = {};

            try {
                args = JSON.parse(toolCall.function.arguments || '{}');
            } catch {
                console.warn('[ReactLoop] Failed to parse tool arguments:', toolCall.function.arguments);
            }

            const result = await executeReactTool(toolName, args, context);

            if (!toolsUsed.includes(toolName)) {
                toolsUsed.push(toolName);
            }

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            });
        }

        iteration++;
    }

    return {
        finalAnswer: '抱歉，这个问题比较复杂，我目前还无法完全解答。请尝试更具体的问题。',
        iterations: iteration,
        toolsUsed,
        error: 'max_iterations_reached',
    };
}

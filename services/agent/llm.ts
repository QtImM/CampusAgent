import { AGENT_CONFIG } from './config';

const DEEPSEEK_API_KEY = AGENT_CONFIG.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = AGENT_CONFIG.DEEPSEEK_BASE_URL;

export type LLMResponse = {
    content: string;
    stop_reason: string;
};

export type AgentModelTier = 'fast' | 'reasoning';

export const resolveModelName = (tier: AgentModelTier): string => (
    tier === 'fast' ? AGENT_CONFIG.FAST_MODEL : AGENT_CONFIG.REASONING_MODEL
);

function assertDeepSeekConfigured() {
    if (!AGENT_CONFIG.DEEPSEEK_ENABLED) {
        throw new Error(
            'DeepSeek API key is not configured. Set EXPO_PUBLIC_DEEPSEEK_API_KEY in .env to a real key and restart Expo.'
        );
    }
}

/**
 * DeepSeek LLM Service
 */
export async function callDeepSeek(
    messages: { role: string, content: string }[],
    options?: { model?: string }
): Promise<string> {
    assertDeepSeekConfigured();
    const model = options?.model || AGENT_CONFIG.FAST_MODEL;
    try {
        const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.error('[LLM] DeepSeek call failed:', e);
        throw e;
    }
}

async function callDeepSeekStreamViaFetch(
    messages: { role: string, content: string }[],
    model: string,
    onToken?: (text: string) => void
): Promise<string> {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            stream: true
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${err}`);
    }

    if (!response.body) {
        return callDeepSeek(messages, { model });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    const consumeSseLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ') || trimmed.includes('[DONE]')) return;

        try {
            const data = JSON.parse(trimmed.substring(6));
            const chunk = data.choices[0]?.delta?.content || '';
            fullText += chunk;
            if (onToken) onToken(fullText);
        } catch {
            // Ignore malformed streaming fragments and continue parsing.
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            consumeSseLine(line);
        }
    }

    if (buffer.trim()) {
        consumeSseLine(buffer);
    }

    return fullText;
}

export type DeepSeekMessageWithTools = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    reasoning_content?: string | null;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }> | null;
    tool_call_id?: string;
};

export type DeepSeekToolSchema = {
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

export type DeepSeekToolCallResponse = {
    content: string | null;
    reasoning_content?: string | null;
    tool_calls: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }> | null;
};

/**
 * Call DeepSeek with function calling support for ReAct loop.
 */
export async function callDeepSeekWithTools(
    messages: DeepSeekMessageWithTools[],
    tools: DeepSeekToolSchema[],
    options?: { model?: string }
): Promise<DeepSeekToolCallResponse> {
    assertDeepSeekConfigured();
    const model = options?.model || AGENT_CONFIG.FAST_MODEL;

    try {
        const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages,
                tools,
                tool_choice: 'auto',
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        const message = data.choices[0]?.message;

        return {
            content: message?.content ?? null,
            reasoning_content: message?.reasoning_content ?? null,
            tool_calls: message?.tool_calls ?? null,
        };
    } catch (e) {
        console.error('[LLM] DeepSeek callWithTools failed:', e);
        throw e;
    }
}

export function callDeepSeekStream(
    messages: { role: string, content: string }[],
    onToken?: (text: string) => void,
    options?: { model?: string }
): Promise<string> {
    assertDeepSeekConfigured();
    const model = options?.model || AGENT_CONFIG.FAST_MODEL;

    if (typeof XMLHttpRequest === 'undefined') {
        return callDeepSeekStreamViaFetch(messages, model, onToken);
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${DEEPSEEK_BASE_URL}/chat/completions`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${DEEPSEEK_API_KEY}`);

        let lastProcessedIndex = 0;
        let fullText = "";

        xhr.onreadystatechange = () => {
            if (xhr.readyState === 3 || xhr.readyState === 4) {
                const currentText = xhr.responseText || "";
                const newData = currentText.substring(lastProcessedIndex);
                lastProcessedIndex = currentText.length;

                const lines = newData.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('data: ') && !line.includes('[DONE]')) {
                        try {
                            const data = JSON.parse(line.trim().substring(6));
                            const chunk = data.choices[0]?.delta?.content || "";
                            fullText += chunk;
                            if (onToken) onToken(fullText);
                        } catch (e) {
                            // ignore parse errors for partial chunks
                        }
                    }
                }

                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        resolve(fullText);
                    } else {
                        reject(new Error(`API Error: ${xhr.status} ${xhr.responseText}`));
                    }
                }
            }
        };

        xhr.onerror = () => reject(new Error("Network Error"));

        xhr.send(JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            stream: true
        }));
    });
}

import { AgentHistoryItem } from './types';
import { callDeepSeek, resolveModelName } from './llm';
import { AGENT_CONFIG } from './config';

const clip = (value: string, max = 100): string => value.length > max ? `${value.slice(0, max)}...` : value;

const clipSummary = (value: string, max = 600): string => value.length > max ? `${value.slice(0, max).trim()}...` : value.trim();

export const summarizeHistory = (
    history: AgentHistoryItem[],
    options?: { keepRecent?: number }
): { summary: string; recentHistory: AgentHistoryItem[] } => {
    const keepRecent = options?.keepRecent ?? 6;
    if (history.length <= keepRecent) {
        return {
            summary: '',
            recentHistory: history,
        };
    }

    const older = history.slice(0, -keepRecent);
    const recentHistory = history.slice(-keepRecent);

    const summaryLines = older.map((item, index) => `${index + 1}. ${item.role}: ${clip(item.content)}`);

    return {
        summary: `Earlier conversation summary:\n${summaryLines.join('\n')}`,
        recentHistory,
    };
};

export const refineHistorySummary = async (input: {
    historySummary?: string;
    recentHistory: AgentHistoryItem[];
    sessionStateText?: string;
}): Promise<string | null> => {
    if (!AGENT_CONFIG.DEEPSEEK_ENABLED) {
        return null;
    }

    const conversationText = input.recentHistory
        .map((item, index) => `${index + 1}. ${item.role}: ${clip(item.content, 180)}`)
        .join('\n');
    const existingSummary = input.historySummary?.trim() || 'None';
    const sessionStateText = input.sessionStateText?.trim() || 'None';

    try {
        const response = await callDeepSeek([
            {
                role: 'system',
                content: [
                    'You compress campus-assistant conversations into a short structured summary.',
                    'Return JSON only: {"summary":"..."}',
                    'Keep the summary under 600 characters.',
                    'Prioritize user profile facts, referenced courses/buildings, pending actions, constraints, and unresolved questions.',
                    'Do not invent facts.',
                ].join(' '),
            },
            {
                role: 'user',
                content: [
                    `Existing summary:\n${existingSummary}`,
                    `Session state:\n${sessionStateText}`,
                    `Recent turns:\n${conversationText}`,
                ].join('\n\n'),
            },
        ], { model: resolveModelName('fast') });

        const parsed = JSON.parse(response);
        if (typeof parsed?.summary !== 'string' || !parsed.summary.trim()) {
            return null;
        }

        return `Model conversation summary:\n${clipSummary(parsed.summary)}`;
    } catch (error) {
        console.warn('[Agent] Failed to refine history summary with fast model, falling back to rules.', error);
        return null;
    }
};


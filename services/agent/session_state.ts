import { AgentHistoryItem, AgentSessionState } from './types';

const clip = (value: string, max = 120): string => value.length > max ? `${value.slice(0, max)}...` : value;

export const createInitialSessionState = (): AgentSessionState => ({
    facts: {},
    recentDecisions: [],
    openLoops: [],
    pendingAction: null,
    pendingDraft: null,
});

export const updateSessionStateWithTurn = (
    state: AgentSessionState,
    item: AgentHistoryItem
): AgentSessionState => {
    const next: AgentSessionState = {
        ...state,
        facts: { ...state.facts },
        recentDecisions: [...state.recentDecisions],
        openLoops: [...state.openLoops],
    };

    if (item.role === 'user') {
        next.goal = next.goal || clip(item.content, 80);
        if (/\b[A-Z]{2,6}\s?\d{4}[A-Z]?\b/i.test(item.content)) {
            next.referencedCourse = item.content.match(/\b([A-Z]{2,6}\s?\d{4}[A-Z]?)\b/i)?.[1]?.replace(/\s+/g, '').toUpperCase();
        }
        if (/\b(?:AAB|ACC|ACH|AML|ASH|CEC|CVA|DLB|FC|FSC|JSC|LMC|NTT|OEE|OEM|OEW|RRS|SCC|SCM|SCT|SPH|SRH|STB|SWT|WHS|WLB|YSS)\b/i.test(item.content)) {
            next.referencedBuilding = item.content.match(/\b(?:AAB|ACC|ACH|AML|ASH|CEC|CVA|DLB|FC|FSC|JSC|LMC|NTT|OEE|OEM|OEW|RRS|SCC|SCM|SCT|SPH|SRH|STB|SWT|WHS|WLB|YSS)\b/i)?.[0]?.toUpperCase();
        }
        if (/帮我|幫我|请|請|我想|我希望|我要/i.test(item.content)) {
            next.activeTask = clip(item.content, 80);
        }
    }

    if (item.role === 'assistant') {
        next.recentDecisions = [...next.recentDecisions, clip(item.content, 80)].slice(-4);
        if (/确认|確認|回复“确认”|回复“是”/.test(item.content) && !next.openLoops.includes('awaiting_confirmation')) {
            next.openLoops.push('awaiting_confirmation');
        }
        if (/已经帮你|已取消|已经记住/.test(item.content)) {
            next.openLoops = next.openLoops.filter(loop => loop !== 'awaiting_confirmation');
        }
    }

    if (item.role === 'tool') {
        next.summary = clip(item.content, 160);
    }

    return next;
};

export const formatSessionState = (state: AgentSessionState): string => {
    const lines = [
        state.goal ? `goal: ${state.goal}` : '',
        state.activeTask ? `activeTask: ${state.activeTask}` : '',
        state.referencedCourse ? `referencedCourse: ${state.referencedCourse}` : '',
        state.referencedBuilding ? `referencedBuilding: ${state.referencedBuilding}` : '',
        state.openLoops.length > 0 ? `openLoops: ${state.openLoops.join(', ')}` : '',
        state.recentDecisions.length > 0 ? `recentDecisions: ${state.recentDecisions.join(' | ')}` : '',
        state.summary ? `latestSummary: ${state.summary}` : '',
        state.pendingAction ? `pendingAction: ${state.pendingAction.type} (missing: ${state.pendingAction.missingRequiredFields.join(', ') || 'none'})` : '',
        state.pendingDraft ? `pendingDraft: ${state.pendingDraft.actionType} (status: ${state.pendingDraft.status}, missing: ${state.pendingDraft.missingFields.join(', ') || 'none'})` : '',
    ].filter(Boolean);

    return lines.length > 0 ? lines.join('\n') : 'No structured session state.';
};

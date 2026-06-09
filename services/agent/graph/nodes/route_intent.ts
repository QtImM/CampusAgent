import { classifyIntent } from '../../router';
import type { AgentGraphState } from '../types';
import { pushTrace } from '../telemetry';

const mapIntent = (decision: ReturnType<typeof classifyIntent>) => {
    if (decision.intent === 'campus_faq') {
        return {
            kind: 'qa' as const,
            domain: 'faq' as const,
            requiresRetrieval: true,
            requiresActionPreparation: false,
            requiresConfirmation: false,
        };
    }

    if (decision.intent === 'course_community_write') {
        return {
            kind: 'action' as const,
            domain: 'course_community' as const,
            requiresRetrieval: false,
            requiresActionPreparation: true,
            requiresConfirmation: true,
        };
    }

    if (decision.intent === 'schedule_query') {
        return {
            kind: 'qa' as const,
            domain: 'schedule' as const,
            requiresRetrieval: false,
            requiresActionPreparation: false,
            requiresConfirmation: false,
        };
    }

    if (decision.intent === 'building_query' || decision.intent === 'nearby_place_query') {
        return {
            kind: 'qa' as const,
            domain: 'campus' as const,
            requiresRetrieval: false,
            requiresActionPreparation: false,
            requiresConfirmation: false,
        };
    }

    return {
        kind: 'hybrid' as const,
        domain: 'mixed' as const,
        requiresRetrieval: true,
        requiresActionPreparation: false,
        requiresConfirmation: false,
    };
};

export const routeIntentNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    const decision = classifyIntent(state.normalizedInput || state.input);
    const mapped = mapIntent(decision);

    return pushTrace(
        {
            ...state,
            intent: {
                ...mapped,
                confidence: decision.confidence,
                reason: decision.reason,
            },
        },
        'route_intent',
        `${mapped.kind}/${mapped.domain}`
    );
};

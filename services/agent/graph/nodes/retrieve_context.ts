import type { AgentGraphState } from '../types';
import { retrieveEvidenceBundle } from '../retrieval';
import { pushTrace } from '../telemetry';
import { Analytics } from '../../analytics';

export const retrieveContextNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    const bundle = await retrieveEvidenceBundle(state, { debug: true });
    const answerability = bundle.evidence.length > 0 ? 'sufficient' : 'insufficient';

    Analytics.track(
        'retrieval_debug',
        {
            query:          bundle.normalized.query,
            rerankProvider: bundle.debug?.rerankProvider,
            perPathCounts:  Object.fromEntries(
                Object.entries(bundle.debug?.perPath ?? {}).map(([k, v]) => [k, v.length])
            ),
            fusedCount:  bundle.debug?.fused.length  ?? 0,
            finalCount:  bundle.evidence.length,
        },
        { sessionId: state.sessionId, userId: state.userId },
    );

    const debug = bundle.debug;
    const summaryParts = [`evidence=${bundle.evidence.length}`];
    if (debug) {
        const pathCounts = Object.entries(debug.perPath)
            .map(([name, items]) => `${name}=${items.length}`)
            .join(',');
        summaryParts.push(`recall(${pathCounts})`, `rerank=${debug.rerankProvider}`);
    }

    return pushTrace(
        {
            ...state,
            retrieval: {
                query: bundle.normalized.query,
                expandedQueries: bundle.normalized.aliasTerms,
                sourcesRequested: ['faq', 'knowledge_base', 'memory'],
                rawResults: bundle.rawResults,
                rankedEvidence: bundle.evidence,
                answerability,
                answerabilityReason: answerability === 'sufficient'
                    ? 'evidence available'
                    : 'no evidence found',
            },
            evidence: bundle.evidence,
        },
        'retrieve_context',
        summaryParts.join(' ')
    );
};

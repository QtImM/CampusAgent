import type {
    GraphIntentState,
    GraphPlanState,
    PendingAction,
} from './types';

export const getIntentBranch = (
    intent: Pick<GraphIntentState, 'kind' | 'requiresRetrieval'>
) => {
    if (intent.kind === 'unsupported') return 'synthesize_response';
    if (intent.requiresRetrieval) return 'retrieve_context';
    return 'plan_next_step';
};

export const getPlannerBranch = (
    plan: Pick<GraphPlanState, 'decision'>
) => {
    console.log('[getPlannerBranch] decision:', plan.decision);
    if (plan.decision === 'answer') return 'synthesize_response';
    if (plan.decision === 'clarify') return 'clarify_user';
    console.log('[getPlannerBranch] falling through to prepare_action for decision:', plan.decision);
    return 'prepare_action';
};

export const getPostPrepareBranch = (pendingAction: PendingAction | null) => {
    console.log('[getPostPrepareBranch] pendingAction:', pendingAction?.type ?? 'null');
    if (!pendingAction) return 'clarify_user';
    if (pendingAction.missingRequiredFields.length > 0) return 'clarify_user';
    return 'confirm_action';
};

export const getConfirmationBranch = (
    confirmation: { required: boolean; satisfied: boolean; cancelled?: boolean }
) => {
    if (confirmation.cancelled) return 'synthesize_response';
    if (confirmation.required && !confirmation.satisfied) return 'synthesize_response';
    return 'execute_tools';
};

import type { AgentGraphState } from '../types';
import { pushTrace } from '../telemetry';

const hasConfirmPhrase = (value: string) => /确认|可以|是的|yes|ok|okay|confirm|是|好|行|没问题|沒問題/i.test(value);
const hasCancelPhrase = (value: string) => /取消|算了|不用了|先不用|停止|cancel|never mind/i.test(value);

export const confirmActionNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    const required = Boolean(state.pendingAction);

    if (!required) {
        return pushTrace(
            { ...state, confirmation: { required: false, satisfied: false } },
            'confirm_action',
            'no action to confirm'
        );
    }

    // Cancel branch
    if (hasCancelPhrase(state.input)) {
        return pushTrace(
            {
                ...state,
                confirmation: {
                    required: true,
                    satisfied: false,
                    cancelled: true,
                    prompt: undefined,
                },
                pendingAction: null,
            },
            'confirm_action',
            'cancelled',
            { checkpoint: 'cancelled' }
        );
    }

    // Confirm branch (possibly with parameter edits)
    const satisfied = hasConfirmPhrase(state.input);
    const prompt = satisfied
        ? undefined
        : `请确认是否执行：${state.pendingAction!.userVisibleSummary}`;

    return pushTrace(
        {
            ...state,
            confirmation: {
                required,
                satisfied,
                prompt,
            },
        },
        'confirm_action',
        satisfied ? 'confirmed' : 'awaiting confirmation',
        { checkpoint: satisfied ? 'completed' : 'confirmation' }
    );
};

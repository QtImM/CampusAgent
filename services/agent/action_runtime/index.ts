/**
 * Action Runtime Entry Point
 *
 * Public API for the Action Agent runtime.
 * See docs/agent/action-agent-migration.md §8.1.
 */

export { runActionAgent, detectActionType } from './action_agent';
export { buildActionPayload, createDefaultDraft, computeMissingFields, REVIEW_PRESETS } from './contract';
export { processFollowup, classifyFollowup, getPresetContentForRating } from './followup_router';
export { buildSuccessResult, buildFailureResult, buildCancelResult } from './template_response';
export { buildToolCallFromDraft, executeToolCall } from './tool_adapter';
export type {
    ActionType,
    ActionPhase,
    ActionStatus,
    ActionPayload,
    ActionBody,
    ActionDraft,
    PendingDraft,
    ActionAgentInput,
    ActionAgentResult,
    PostCourseReviewDraft,
    PostCourseTeamingDraft,
    SendCourseChatMessageDraft,
    CreateUserCalendarEventDraft,
    WriteUserScheduleEntryDraft,
    UiSchema,
    ActionSummary,
    ActionMessage,
    ActionNextStep,
} from './types';

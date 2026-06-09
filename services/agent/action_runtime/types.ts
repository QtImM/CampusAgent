/**
 * Action Runtime Types
 *
 * Unified contract for structured write operations.
 * See docs/agent/action-agent-contract-and-flow.md for the full specification.
 */

// ─── Action Type Enum ───────────────────────────────────────────────

export type ActionType =
    | 'post_course_review'
    | 'post_teacher_review'
    | 'post_course_teaming'
    | 'send_course_chat_message'
    | 'create_user_calendar_event'
    | 'write_user_schedule_entry';

// ─── Phase / Status ─────────────────────────────────────────────────

export type ActionPhase = 'draft' | 'confirm' | 'submitting' | 'result';

export type ActionStatus =
    | 'awaiting_user_input'
    | 'ready_for_confirmation'
    | 'submitting'
    | 'completed'
    | 'failed'
    | 'cancelled';

// ─── Draft Structures ───────────────────────────────────────────────

export type PostCourseReviewDraft = {
    courseCode: string | null;
    rating: number | null;
    difficulty: number | null;
    content: string;
    anonymous: boolean;
};

export type PostTeacherReviewDraft = {
    teacherName: string | null;
    teacherId: string | null;
    rating: number | null;
    difficulty: number | null;
    workload: number | null;
    content: string;
    tags: string[];
};

export type PostCourseTeamingDraft = {
    courseCode: string | null;
    section: string;
    content: string;
    contactMethod: string;
};

export type SendCourseChatMessageDraft = {
    courseCode: string | null;
    content: string;
};

export type CreateUserCalendarEventDraft = {
    title: string;
    eventType: string;
    eventDate: string | null;
    startTime: string | null;
    endTime: string | null;
    location: string;
    note: string;
    courseCode: string | null;
};

export type WriteUserScheduleEntryDraft = {
    title: string;
    courseCode: string | null;
    dayOfWeek: number | null;
    startTime: string | null;
    endTime: string | null;
    room: string;
    weekText: string;
};

export type ActionDraft =
    | PostCourseReviewDraft
    | PostTeacherReviewDraft
    | PostCourseTeamingDraft
    | SendCourseChatMessageDraft
    | CreateUserCalendarEventDraft
    | WriteUserScheduleEntryDraft;

// ─── UI Schema ──────────────────────────────────────────────────────

export type UiFieldDefinition = {
    name: string;
    label: string;
    component: string;
    required: boolean;
    readonly?: boolean;
    placeholder?: string;
    scale?: number;
};

export type ReviewPresets = {
    ratingToContentTemplates: Record<string, string[]>;
};

export type UiSchema = {
    surface: string;
    title?: string;
    submitLabel?: string;
    cancelLabel?: string;
    fields?: UiFieldDefinition[];
    presets?: ReviewPresets;
};

// ─── Summary ────────────────────────────────────────────────────────

export type ActionSummary = {
    title: string;
    lines: string[];
};

// ─── Message ────────────────────────────────────────────────────────

export type ActionMessage = {
    text: string;
    tone?: 'neutral' | 'positive' | 'warning' | 'error';
};

// ─── Next Step ──────────────────────────────────────────────────────

export type ExpectedUserAction =
    | 'fill_or_edit_draft'
    | 'confirm_or_edit'
    | 'none';

export type AllowedInput =
    | 'free_text'
    | 'field_edit'
    | 'preset_select'
    | 'confirm'
    | 'cancel'
    | 'retry';

export type ActionNextStep = {
    expectedUserAction: ExpectedUserAction;
    allowedInputs: AllowedInput[];
};

// ─── Action Body ────────────────────────────────────────────────────

export type ActionBody = {
    actionType: ActionType;
    phase: ActionPhase;
    status: ActionStatus;
    canConfirm: boolean;
    canSubmit: boolean;
    canCancel: boolean;
    requiresConfirmation: boolean;
    missingFields: string[];
    editableFields: string[];
    draft: ActionDraft;
    uiSchema: UiSchema;
    summary: ActionSummary;
    fieldErrors?: Record<string, string>;
};

// ─── Top-Level Payload ──────────────────────────────────────────────

export type ActionPayload = {
    type: 'agent_action';
    version: '1.0';
    requestId: string;
    sessionId: string;
    message: ActionMessage;
    action: ActionBody;
    next: ActionNextStep;
    meta?: {
        source: 'action_agent';
        latencyTier: 'fast';
    };
};

// ─── Pending Draft (Session State) ──────────────────────────────────

export type PendingDraft = {
    actionType: ActionType;
    phase: ActionPhase;
    status: ActionStatus;
    draft: ActionDraft;
    missingFields: string[];
    uiSchema: UiSchema;
    summary: ActionSummary;
    source: 'action_agent';
    requestId: string;
    sessionId: string;
};

// ─── Action Agent Input ─────────────────────────────────────────────

export type ActionAgentInput = {
    input: string;
    userId: string;
    sessionId: string;
    requestId: string;
    pendingDraft: PendingDraft | null;
    history: Array<{ role: string; content: string }>;
    sessionState: AgentSessionState;
};

// ─── Action Agent Result ────────────────────────────────────────────

export type ActionAgentResult = {
    finalAnswer: string;
    actionPayload: ActionPayload | null;
    pendingDraft: PendingDraft | null;
    toolExecuted: boolean;
    toolSuccess?: boolean;
};
import type { AgentSessionState } from '../types';

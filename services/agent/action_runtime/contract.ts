/**
 * Contract Builder
 *
 * Constructs ActionPayload responses according to the contract spec.
 * See docs/agent/action-agent-contract-and-flow.md §3-§9.
 */

import type {
    ActionBody,
    ActionDraft,
    ActionMessage,
    ActionNextStep,
    ActionPayload,
    ActionPhase,
    ActionStatus,
    ActionSummary,
    ActionType,
    AllowedInput,
    CreateUserCalendarEventDraft,
    ExpectedUserAction,
    PostCourseReviewDraft,
    PostTeacherReviewDraft,
    PostCourseTeamingDraft,
    SendCourseChatMessageDraft,
    UiSchema,
    WriteUserScheduleEntryDraft,
} from './types';

// ─── Default Draft Factories ────────────────────────────────────────

export const createDefaultReviewDraft = (): PostCourseReviewDraft => ({
    courseCode: null,
    rating: null,
    difficulty: null,
    content: '',
    anonymous: false,
});

export const createDefaultTeamingDraft = (): PostCourseTeamingDraft => ({
    courseCode: null,
    section: '',
    content: '',
    contactMethod: '',
});

export const createDefaultChatMessageDraft = (): SendCourseChatMessageDraft => ({
    courseCode: null,
    content: '',
});

export const createDefaultCalendarEventDraft = (): CreateUserCalendarEventDraft => ({
    title: '',
    eventType: 'custom',
    eventDate: null,
    startTime: null,
    endTime: null,
    location: '',
    note: '',
    courseCode: null,
});

export const createDefaultScheduleEntryDraft = (): WriteUserScheduleEntryDraft => ({
    title: '',
    courseCode: null,
    dayOfWeek: null,
    startTime: null,
    endTime: null,
    room: '',
    weekText: '',
});

export const createDefaultTeacherReviewDraft = (): PostTeacherReviewDraft => ({
    teacherName: null,
    teacherId: null,
    rating: null,
    difficulty: null,
    workload: null,
    content: '',
    tags: [],
});

export const createDefaultDraft = (actionType: ActionType): ActionDraft => {
    switch (actionType) {
        case 'post_course_review': return createDefaultReviewDraft();
        case 'post_teacher_review': return createDefaultTeacherReviewDraft();
        case 'post_course_teaming': return createDefaultTeamingDraft();
        case 'send_course_chat_message': return createDefaultChatMessageDraft();
        case 'create_user_calendar_event': return createDefaultCalendarEventDraft();
        case 'write_user_schedule_entry': return createDefaultScheduleEntryDraft();
    }
};

// ─── Missing Fields Computation ─────────────────────────────────────

export const computeMissingFields = (actionType: ActionType, draft: ActionDraft): string[] => {
    switch (actionType) {
        case 'post_course_review': {
            const d = draft as PostCourseReviewDraft;
            return [
                ...(!d.courseCode ? ['courseCode'] : []),
                ...(d.rating == null ? ['rating'] : []),
                ...(!d.content ? ['content'] : []),
            ];
        }
        case 'post_teacher_review': {
            const d = draft as PostTeacherReviewDraft;
            return [
                ...(!d.teacherName ? ['teacherName'] : []),
                ...(d.rating == null ? ['rating'] : []),
                ...(!d.content ? ['content'] : []),
            ];
        }
        case 'post_course_teaming': {
            const d = draft as PostCourseTeamingDraft;
            return [
                ...(!d.courseCode ? ['courseCode'] : []),
                ...(!d.section ? ['section'] : []),
                ...(!d.content ? ['content'] : []),
            ];
        }
        case 'send_course_chat_message': {
            const d = draft as SendCourseChatMessageDraft;
            return [
                ...(!d.courseCode ? ['courseCode'] : []),
                ...(!d.content ? ['content'] : []),
            ];
        }
        case 'create_user_calendar_event': {
            const d = draft as CreateUserCalendarEventDraft;
            return [
                ...(!d.title ? ['title'] : []),
                ...(!d.eventDate ? ['eventDate'] : []),
            ];
        }
        case 'write_user_schedule_entry': {
            const d = draft as WriteUserScheduleEntryDraft;
            return [
                ...(!d.title ? ['title'] : []),
                ...(d.dayOfWeek == null ? ['dayOfWeek'] : []),
                ...(!d.startTime ? ['startTime'] : []),
                ...(!d.endTime ? ['endTime'] : []),
            ];
        }
    }
};

// ─── Editable Fields ────────────────────────────────────────────────

const ALL_EDITABLE_FIELDS: Record<ActionType, string[]> = {
    post_course_review: ['courseCode', 'rating', 'difficulty', 'content', 'anonymous'],
    post_teacher_review: ['teacherName', 'rating', 'difficulty', 'workload', 'content', 'tags'],
    post_course_teaming: ['courseCode', 'section', 'content', 'contactMethod'],
    send_course_chat_message: ['courseCode', 'content'],
    create_user_calendar_event: ['title', 'eventType', 'eventDate', 'startTime', 'endTime', 'location', 'note', 'courseCode'],
    write_user_schedule_entry: ['title', 'courseCode', 'dayOfWeek', 'startTime', 'endTime', 'room', 'weekText'],
};

export const getEditableFields = (actionType: ActionType): string[] =>
    ALL_EDITABLE_FIELDS[actionType] || [];

// ─── UI Schema Factories ────────────────────────────────────────────

export const REVIEW_PRESETS = {
    ratingToContentTemplates: {
        '1': [
            '这门课体验不太好，内容和节奏都有待改进。',
            '作业和讲解之间衔接不够顺畅。',
        ],
        '2': [
            '整体体验一般，有些部分比较吃力。',
            '课程有帮助，但教学节奏可以更清晰。',
        ],
        '3': [
            '整体中规中矩，适合愿意自己补充学习的同学。',
            '课程内容还可以，但有些地方可以讲得更细。',
        ],
        '4': [
            '课程整体不错，内容比较清晰，也有收获。',
            '老师讲解比较清楚，作业安排也算合理。',
        ],
        '5': [
            '老师讲解清晰，课程很有收获，推荐选修。',
            '整体体验很好，内容扎实，学习收获很大。',
        ],
    },
};

export const createReviewUiSchema = (phase: ActionPhase, options?: { courseLocked?: boolean; courseName?: string }): UiSchema => {
    if (phase === 'confirm') {
        return {
            surface: 'review_confirm_modal',
            title: '确认发布课程评价',
        };
    }
    if (phase === 'result') {
        return { surface: 'result_card' };
    }
    const courseLabel = options?.courseName
        ? `课程：${options.courseName}`
        : '课程代码';
    return {
        surface: 'review_modal',
        title: '发布课程评价',
        submitLabel: '提交评价',
        cancelLabel: '取消',
        fields: [
            { name: 'courseCode', label: courseLabel, component: 'course_picker', required: true, readonly: options?.courseLocked, placeholder: '例如 COMP3015' },
            { name: 'rating', label: '评分', component: 'rating_picker', required: true, scale: 5 },
            { name: 'difficulty', label: '难度 (1=简单, 5=困难)', component: 'number_picker', required: false, scale: 5 },
            { name: 'content', label: '评价内容', component: 'textarea', required: true, placeholder: '写下你的上课体验' },
            { name: 'anonymous', label: '匿名发布', component: 'switch', required: false },
        ],
        presets: REVIEW_PRESETS,
    };
};

export const createTeacherReviewUiSchema = (phase: ActionPhase, options?: { teacherLocked?: boolean; teacherName?: string }): UiSchema => {
    if (phase === 'confirm') {
        return {
            surface: 'teacher_review_confirm_modal',
            title: '确认发布教师评价',
        };
    }
    if (phase === 'result') {
        return { surface: 'result_card' };
    }
    const teacherLabel = options?.teacherName
        ? `教师：${options.teacherName}`
        : '教师姓名';
    return {
        surface: 'teacher_review_modal',
        title: '发布教师评价',
        submitLabel: '提交评价',
        cancelLabel: '取消',
        fields: [
            { name: 'teacherName', label: teacherLabel, component: 'teacher_picker', required: true, readonly: options?.teacherLocked, placeholder: '例如 Dr. Chan' },
            { name: 'rating', label: '总体评分', component: 'rating_picker', required: true, scale: 5 },
            { name: 'difficulty', label: '难度', component: 'rating_picker', required: false, scale: 5 },
            { name: 'workload', label: '工作量', component: 'rating_picker', required: false, scale: 5 },
            { name: 'content', label: '评价内容', component: 'textarea', required: true, placeholder: '写下你对这位老师的评价' },
            { name: 'tags', label: '标签', component: 'tag_picker', required: false, placeholder: '选择标签' },
        ],
    };
};

export const createUiSchema = (actionType: ActionType, phase: ActionPhase, options?: { courseLocked?: boolean; courseName?: string; teacherLocked?: boolean; teacherName?: string }): UiSchema => {
    switch (actionType) {
        case 'post_course_review': return createReviewUiSchema(phase, options);
        case 'post_teacher_review': return createTeacherReviewUiSchema(phase, options);
        case 'post_course_teaming': return { surface: phase === 'confirm' ? 'teaming_confirm_modal' : 'teaming_modal' };
        case 'send_course_chat_message': return { surface: phase === 'confirm' ? 'chat_confirm_modal' : 'chat_modal' };
        case 'create_user_calendar_event': return { surface: phase === 'confirm' ? 'calendar_confirm_modal' : 'calendar_modal' };
        case 'write_user_schedule_entry': return { surface: phase === 'confirm' ? 'schedule_confirm_modal' : 'schedule_modal' };
    }
};

// ─── Summary Builder ────────────────────────────────────────────────

const labelMap: Record<string, string> = {
    courseCode: '课程',
    teacherName: '教师',
    teacherId: '教师ID',
    rating: '评分',
    difficulty: '难度',
    workload: '工作量',
    content: '内容',
    anonymous: '匿名',
    tags: '标签',
    section: '小组',
    contactMethod: '联系方式',
    title: '标题',
    eventType: '类型',
    eventDate: '日期',
    startTime: '开始时间',
    endTime: '结束时间',
    location: '地点',
    note: '备注',
    dayOfWeek: '星期',
    room: '教室',
    weekText: '周次',
};

const dayOfWeekLabels = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const formatFieldValue = (key: string, value: any): string => {
    if (value == null || value === '') return '未填写';
    if (key === 'rating' || key === 'difficulty' || key === 'workload') return `${value}/5`;
    if (key === 'anonymous') return value ? '是' : '否';
    if (key === 'tags' && Array.isArray(value)) return value.length > 0 ? value.join(', ') : '无';
    if (key === 'dayOfWeek' && typeof value === 'number') return dayOfWeekLabels[value] || String(value);
    return String(value);
};

export const buildSummary = (actionType: ActionType, draft: ActionDraft, phase: ActionPhase): ActionSummary => {
    const d = draft as Record<string, any>;
    const titleMap: Record<ActionType, Record<ActionPhase, string>> = {
        post_course_review: { draft: '课程评价草稿', confirm: '待发布课程评价', submitting: '提交中', result: '已发布课程评价' },
        post_teacher_review: { draft: '教师评价草稿', confirm: '待发布教师评价', submitting: '提交中', result: '已发布教师评价' },
        post_course_teaming: { draft: '组队草稿', confirm: '待发布组队', submitting: '提交中', result: '已发布组队' },
        send_course_chat_message: { draft: '消息草稿', confirm: '待发送消息', submitting: '提交中', result: '已发送消息' },
        create_user_calendar_event: { draft: '日历事件草稿', confirm: '待创建事件', submitting: '提交中', result: '已创建事件' },
        write_user_schedule_entry: { draft: '课表草稿', confirm: '待写入课表', submitting: '提交中', result: '已写入课表' },
    };

    const fieldKeys = Object.keys(d);
    const lines = fieldKeys
        .filter(key => key in labelMap)
        .map(key => `${labelMap[key]}：${formatFieldValue(key, d[key])}`);

    return {
        title: titleMap[actionType][phase],
        lines: lines.length > 0 ? lines : ['暂无信息'],
    };
};

// ─── Next Step Builder ──────────────────────────────────────────────

const buildNextStep = (actionType: ActionType, phase: ActionPhase, missingFields: string[]): ActionNextStep => {
    if (phase === 'result') {
        return { expectedUserAction: 'none', allowedInputs: [] };
    }
    if (phase === 'confirm') {
        return { expectedUserAction: 'confirm_or_edit', allowedInputs: ['confirm', 'cancel', 'field_edit'] };
    }
    // draft phase
    const inputs: AllowedInput[] = ['free_text', 'field_edit', 'cancel'];
    if (missingFields.length === 0) {
        inputs.push('confirm');
    }
    if (actionType === 'post_course_review' || actionType === 'post_teacher_review') {
        inputs.push('preset_select');
    }
    return { expectedUserAction: 'fill_or_edit_draft', allowedInputs: inputs };
};

// ─── Phase/Status Helpers ───────────────────────────────────────────

export const derivePhaseAndStatus = (
    missingFields: string[],
    override?: { phase?: ActionPhase; status?: ActionStatus }
): { phase: ActionPhase; status: ActionStatus } => {
    if (override?.phase && override?.status) return { phase: override.phase, status: override.status };
    if (missingFields.length > 0) return { phase: 'draft', status: 'awaiting_user_input' };
    return { phase: 'confirm', status: 'ready_for_confirmation' };
};

// ─── Action Payload Builder ─────────────────────────────────────────

export const buildActionPayload = (params: {
    actionType: ActionType;
    draft: ActionDraft;
    requestId: string;
    sessionId: string;
    messageText: string;
    messageTone?: ActionMessage['tone'];
    phaseOverride?: ActionPhase;
    statusOverride?: ActionStatus;
    fieldErrors?: Record<string, string>;
    courseLocked?: boolean;
    courseName?: string;
    teacherLocked?: boolean;
    teacherName?: string;
}): ActionPayload => {
    const missingFields = computeMissingFields(params.actionType, params.draft);
    const { phase, status } = derivePhaseAndStatus(missingFields, {
        phase: params.phaseOverride,
        status: params.statusOverride,
    });

    const canAct = missingFields.length === 0;
    const isResult = phase === 'result';

    const actionBody: ActionBody = {
        actionType: params.actionType,
        phase,
        status,
        canConfirm: canAct && phase === 'confirm',
        canSubmit: canAct && (phase === 'confirm' || phase === 'draft'),
        canCancel: !isResult,
        requiresConfirmation: true,
        missingFields,
        editableFields: isResult ? [] : getEditableFields(params.actionType),
        draft: params.draft,
        uiSchema: createUiSchema(params.actionType, phase, { courseLocked: params.courseLocked, courseName: params.courseName, teacherLocked: params.teacherLocked, teacherName: params.teacherName }),
        summary: buildSummary(params.actionType, params.draft, phase),
        ...(params.fieldErrors ? { fieldErrors: params.fieldErrors } : {}),
    };

    return {
        type: 'agent_action',
        version: '1.0',
        requestId: params.requestId,
        sessionId: params.sessionId,
        message: { text: params.messageText, tone: params.messageTone },
        action: actionBody,
        next: buildNextStep(params.actionType, phase, missingFields),
        meta: { source: 'action_agent', latencyTier: 'fast' },
    };
};

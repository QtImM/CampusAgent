import type { AgentGraphState, PendingAction } from '../types';
import { pushTrace } from '../telemetry';

const extractCourseCode = (value: string) => {
    const match = value.toUpperCase().match(/\b([A-Z]{2,6}\s?\d{4}[A-Z]?)\b/);
    return match ? match[1].replace(/\s+/g, '') : undefined;
};

const WEEKDAY_PATTERNS: Array<{ dayOfWeek: number; patterns: RegExp[] }> = [
    { dayOfWeek: 1, patterns: [/monday/i, /mon\b/i, /周一/, /星期一/] },
    { dayOfWeek: 2, patterns: [/tuesday/i, /tue\b/i, /周二/, /星期二/] },
    { dayOfWeek: 3, patterns: [/wednesday/i, /wed\b/i, /周三/, /星期三/] },
    { dayOfWeek: 4, patterns: [/thursday/i, /thu\b/i, /周四/, /星期四/] },
    { dayOfWeek: 5, patterns: [/friday/i, /fri\b/i, /周五/, /星期五/] },
    { dayOfWeek: 6, patterns: [/saturday/i, /sat\b/i, /周六/, /星期六/] },
    { dayOfWeek: 7, patterns: [/sunday/i, /sun\b/i, /周日/, /周天/, /星期日/, /星期天/] },
];

const extractDayOfWeek = (value: string) => (
    WEEKDAY_PATTERNS.find(item => item.patterns.some(pattern => pattern.test(value)))?.dayOfWeek
);

const formatHour = (value: string) => value.padStart(2, '0');

const extractTimeRange = (value: string) => {
    const match = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|~|to)\s*([01]?\d|2[0-3]):([0-5]\d)\b/i);
    if (!match) return {};

    return {
        startTime: `${formatHour(match[1])}:${match[2]}`,
        endTime: `${formatHour(match[3])}:${match[4]}`,
    };
};

const extractRating = (value: string) => {
    const englishMatch = value.match(/\b([1-5])\s*(?:stars?)\b/i);
    if (englishMatch) return Number(englishMatch[1]);

    const chineseMatch = value.match(/(^|[^\d])([1-5])\s*星/);
    if (chineseMatch) return Number(chineseMatch[2]);

    const standaloneMatch = value.trim().match(/^([1-5])$/);
    return standaloneMatch ? Number(standaloneMatch[1]) : undefined;
};

const extractContentAfterSeparator = (value: string) => {
    const match = value.match(/[:：]\s*(.+)$/);
    return match?.[1]?.trim();
};

const extractRoom = (value: string): string | undefined => {
    const atMatch = value.match(/(?:在|@)\s*([A-Za-z]{2,}[ -]?\d{2,}[A-Za-z]?)/);
    if (atMatch?.[1]) return atMatch[1].trim().replace(/\s+/g, '');

    const bareMatch = value.match(/\b([A-Za-z]{2,}[ -]?\d{2,}[A-Za-z]?)\b/);
    return bareMatch?.[1]?.trim().replace(/\s+/g, '');
};

const mergeDefined = <T extends Record<string, any>>(base: T, patch: Partial<T>): T => {
    const next = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined && value !== null && value !== '') {
            (next as any)[key] = value;
        }
    }
    return next;
};

const looksLikeQuestion = (value: string): boolean => (
    /[?？]|什么时候|什麼時候|怎么|怎麼|如何|why|what|when|where|which|how/i.test(value)
);

const isSlotFillingFollowUp = (input: string, existing: PendingAction | null): boolean => {
    if (!existing) return false;

    const hasNewActionKeyword = /帮我|幫我|发布|發佈|发到|發到|写评价|寫評價|组队|組隊|记进|記進|记到|記到|记一下|記一下|记个|記個/i.test(input);
    if (hasNewActionKeyword) return false;

    const trimmed = input.trim();
    if (!trimmed || looksLikeQuestion(trimmed)) return false;

    const looksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const looksLikeRating = /^[1-5]\s*(?:星|stars?)?$/i.test(trimmed);
    const looksLikeSection = /^section\s+[A-Za-z0-9-]+/i.test(trimmed);
    const looksLikeWeekday = /^(周一|周二|周三|周四|周五|周六|周日|星期[一二三四五六日天])/.test(trimmed);
    const looksLikeTime = /^\d{1,2}:\d{2}/.test(trimmed);
    const looksLikeRoomValue = /^(?:@?\s*[A-Za-z]{2,}[ -]?\d{2,}[A-Za-z]?)$/.test(trimmed);
    const looksLikePlainContent = trimmed.length >= 2 && trimmed.length <= 120;

    if (existing.type === 'write_user_schedule_entry') {
        return looksLikeWeekday || looksLikeTime || looksLikeRoomValue || looksLikeDate;
    }

    if (existing.type === 'create_user_calendar_event') {
        return looksLikeDate || looksLikeTime || looksLikeRoomValue;
    }

    if (existing.type === 'post_course_review') {
        return looksLikeRating || (existing.missingRequiredFields.includes('content') && looksLikePlainContent);
    }

    if (existing.type === 'post_course_teaming') {
        return looksLikeSection || (existing.missingRequiredFields.includes('content') && looksLikePlainContent);
    }

    if (existing.type === 'send_course_chat_message') {
        return existing.missingRequiredFields.includes('content') && looksLikePlainContent;
    }

    return false;
};

const buildScheduleAction = (state: AgentGraphState): PendingAction => {
    const courseCode = extractCourseCode(state.input);
    const dayOfWeek = extractDayOfWeek(state.input);
    const timeRange = extractTimeRange(state.input);
    const room = extractRoom(state.input);
    const params = {
        title: courseCode || 'Manual schedule entry',
        courseCode,
        dayOfWeek,
        room,
        ...timeRange,
    };
    const hasTime = Boolean(params.startTime && params.endTime);
    const missingRequiredFields = [
        ...(!params.title ? ['title'] : []),
        ...(!dayOfWeek ? ['dayOfWeek'] : []),
        ...(!hasTime ? ['timeRange'] : []),
    ];

    return {
        type: 'write_user_schedule_entry',
        params,
        missingRequiredFields,
        userVisibleSummary: hasTime
            ? `Write ${params.title} to schedule on day ${dayOfWeek}, ${params.startTime}-${params.endTime}`
            : `Write ${params.title} to schedule`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const buildCourseReviewAction = (state: AgentGraphState): PendingAction => {
    const courseCode = extractCourseCode(state.input);
    const rating = extractRating(state.input);
    const content = extractContentAfterSeparator(state.input);
    const missingRequiredFields = [
        ...(!courseCode ? ['courseCode'] : []),
        ...(!rating ? ['rating'] : []),
        ...(!content ? ['content'] : []),
    ];

    return {
        type: 'post_course_review',
        params: {
            courseCode,
            rating,
            content,
        },
        missingRequiredFields,
        userVisibleSummary: `Post ${rating || '?'} star review to ${courseCode || 'the course'}`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const buildCourseTeamingAction = (state: AgentGraphState): PendingAction => {
    const courseCode = extractCourseCode(state.input);
    const section = state.input.match(/\bsection\s+([A-Za-z0-9-]+)/i)?.[1];
    const content = extractContentAfterSeparator(state.input);
    const missingRequiredFields = [
        ...(!courseCode ? ['courseCode'] : []),
        ...(!section ? ['section'] : []),
        ...(!content ? ['content'] : []),
    ];

    return {
        type: 'post_course_teaming',
        params: {
            courseCode,
            section,
            content,
        },
        missingRequiredFields,
        userVisibleSummary: `Post teaming request to ${courseCode || 'the course'}`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const buildCourseChatAction = (state: AgentGraphState): PendingAction => {
    const courseCode = extractCourseCode(state.input);
    const content = extractContentAfterSeparator(state.input);
    const missingRequiredFields = [
        ...(!courseCode ? ['courseCode'] : []),
        ...(!content ? ['content'] : []),
    ];

    return {
        type: 'send_course_chat_message',
        params: {
            courseCode,
            content,
        },
        missingRequiredFields,
        userVisibleSummary: `Send message to ${courseCode || 'the course'} chat`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const mergeScheduleAction = (
    existing: PendingAction & { type: 'write_user_schedule_entry' },
    state: AgentGraphState
): PendingAction => {
    const courseCode = extractCourseCode(state.input) || existing.params.courseCode;
    const dayOfWeek = extractDayOfWeek(state.input) ?? existing.params.dayOfWeek;
    const timeRange = extractTimeRange(state.input);
    const room = extractRoom(state.input) || existing.params.room;
    const params = mergeDefined(existing.params, {
        title: courseCode || existing.params.title,
        courseCode,
        dayOfWeek,
        room,
        ...timeRange,
    });
    const hasTime = Boolean(params.startTime && params.endTime);
    const missingRequiredFields = [
        ...(!params.title ? ['title'] : []),
        ...(!dayOfWeek ? ['dayOfWeek'] : []),
        ...(!hasTime ? ['timeRange'] : []),
    ];

    return {
        type: 'write_user_schedule_entry',
        params,
        missingRequiredFields,
        userVisibleSummary: hasTime
            ? `Write ${params.title} to schedule on day ${dayOfWeek}, ${params.startTime}-${params.endTime}`
            : `Write ${params.title} to schedule`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const mergeCalendarEventAction = (
    existing: PendingAction & { type: 'create_user_calendar_event' },
    state: AgentGraphState
): PendingAction => {
    const courseCode = extractCourseCode(state.input) || existing.params.courseCode;
    const eventDateMatch = state.input.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    const timeRange = extractTimeRange(state.input);
    const room = extractRoom(state.input) || existing.params.location;
    const params = mergeDefined(existing.params, {
        title: courseCode ? `${courseCode} ${existing.params.eventType || 'Event'}` : existing.params.title,
        eventDate: eventDateMatch?.[1] || existing.params.eventDate,
        courseCode,
        location: room,
        ...timeRange,
    });
    const missingRequiredFields = [
        ...(!params.eventDate ? ['eventDate'] : []),
    ];

    return {
        type: 'create_user_calendar_event',
        params,
        missingRequiredFields,
        userVisibleSummary: params.eventDate
            ? `创建 ${params.eventDate} 的 ${courseCode || 'Event'} 日历事件`
            : `创建 ${courseCode || 'Event'} 日历事件`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const mergeReviewAction = (
    existing: PendingAction & { type: 'post_course_review' },
    state: AgentGraphState
): PendingAction => {
    const courseCode = extractCourseCode(state.input) || existing.params.courseCode;
    const rating = extractRating(state.input) ?? existing.params.rating;
    const content = extractContentAfterSeparator(state.input) || existing.params.content;
    const missingRequiredFields = [
        ...(!courseCode ? ['courseCode'] : []),
        ...(!rating ? ['rating'] : []),
        ...(!content ? ['content'] : []),
    ];

    return {
        type: 'post_course_review',
        params: { courseCode, rating, content },
        missingRequiredFields,
        userVisibleSummary: `Post ${rating || '?'} star review to ${courseCode || 'the course'}`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const mergeTeamingAction = (
    existing: PendingAction & { type: 'post_course_teaming' },
    state: AgentGraphState
): PendingAction => {
    const courseCode = extractCourseCode(state.input) || existing.params.courseCode;
    const section = state.input.match(/\bsection\s+([A-Za-z0-9-]+)/i)?.[1] || existing.params.section;
    const content = extractContentAfterSeparator(state.input) || existing.params.content;
    const missingRequiredFields = [
        ...(!courseCode ? ['courseCode'] : []),
        ...(!section ? ['section'] : []),
        ...(!content ? ['content'] : []),
    ];

    return {
        type: 'post_course_teaming',
        params: { courseCode, section, content },
        missingRequiredFields,
        userVisibleSummary: `Post teaming request to ${courseCode || 'the course'}`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

const mergeChatAction = (
    existing: PendingAction & { type: 'send_course_chat_message' },
    state: AgentGraphState
): PendingAction => {
    const courseCode = extractCourseCode(state.input) || existing.params.courseCode;
    const content = extractContentAfterSeparator(state.input) || existing.params.content;
    const missingRequiredFields = [
        ...(!courseCode ? ['courseCode'] : []),
        ...(!content ? ['content'] : []),
    ];

    return {
        type: 'send_course_chat_message',
        params: { courseCode, content },
        missingRequiredFields,
        userVisibleSummary: `Send message to ${courseCode || 'the course'} chat`,
        safeToExecute: missingRequiredFields.length === 0,
    };
};

export const prepareActionNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    console.log('[prepareActionNode] called, proposedActionType:', state.plan.proposedActionType, 'existing:', state.pendingAction?.type ?? 'null');
    const existing = state.pendingAction;
    const isFollowUp = isSlotFillingFollowUp(state.input, existing);

    if (existing && isFollowUp) {
        let merged: PendingAction;

        if (existing.type === 'write_user_schedule_entry') {
            merged = mergeScheduleAction(existing, state);
        } else if (existing.type === 'create_user_calendar_event') {
            merged = mergeCalendarEventAction(existing, state);
        } else if (existing.type === 'post_course_review') {
            merged = mergeReviewAction(existing, state);
        } else if (existing.type === 'post_course_teaming') {
            merged = mergeTeamingAction(existing, state);
        } else if (existing.type === 'send_course_chat_message') {
            merged = mergeChatAction(existing, state);
        } else {
            merged = existing;
        }

        return pushTrace(
            { ...state, pendingAction: merged },
            'prepare_action',
            `merged: ${merged.userVisibleSummary}`
        );
    }

    const isNewActionRequest = /帮我|幫我|发布|發佈|发到|發到|写评价|寫評價|组队|組隊|记进|記進|记到|記到|记一下|記一下|记个|記個/i.test(state.input);
    if (existing && !isFollowUp && !isNewActionRequest) {
        return pushTrace(
            { ...state, pendingAction: existing },
            'prepare_action',
            'preserved existing pending action'
        );
    }

    if (state.plan.proposedActionType === 'create_user_calendar_event') {
        const courseCode = extractCourseCode(state.input);
        const eventDateMatch = state.input.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        const pendingAction: PendingAction = {
            type: 'create_user_calendar_event',
            params: {
                title: courseCode ? `${courseCode} Quiz` : 'Quiz',
                eventType: 'quiz',
                eventDate: eventDateMatch?.[1],
                courseCode,
            },
            missingRequiredFields: eventDateMatch ? [] : ['eventDate'],
            userVisibleSummary: eventDateMatch
                ? `创建 ${eventDateMatch[1]} 的 ${courseCode || 'Quiz'} 日历事件`
                : `创建 ${courseCode || 'Quiz'} 日历事件`,
            safeToExecute: Boolean(eventDateMatch),
        };

        return pushTrace(
            { ...state, pendingAction },
            'prepare_action',
            pendingAction.userVisibleSummary
        );
    }

    const actionBuilders: Partial<Record<PendingAction['type'], (state: AgentGraphState) => PendingAction>> = {
        write_user_schedule_entry: buildScheduleAction,
        post_course_review: buildCourseReviewAction,
        post_course_teaming: buildCourseTeamingAction,
        send_course_chat_message: buildCourseChatAction,
    };
    const actionBuilder = state.plan.proposedActionType
        ? actionBuilders[state.plan.proposedActionType]
        : undefined;

    if (actionBuilder) {
        const pendingAction = actionBuilder(state);

        return pushTrace(
            { ...state, pendingAction },
            'prepare_action',
            pendingAction.userVisibleSummary
        );
    }

    return pushTrace(
        {
            ...state,
            clarification: {
                needed: true,
                missingSlots: ['supported_action_type'],
                question: '我暂时还不能安全地准备这个写操作，请先改成课程评价、组队、课表或日历事件。',
                scope: 'action_parameters',
            },
        },
        'prepare_action',
        'unsupported action'
    );
};

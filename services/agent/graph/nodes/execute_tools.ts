import { createCalendarEventTool } from '../tools/calendar_tools';
import {
    postCourseReviewTool,
    postCourseTeamingTool,
    sendCourseChatMessageTool,
} from '../tools/course_community_tools';
import { writeUserScheduleTool } from '../tools/schedule_tools';
import type { AgentGraphState, PendingAction, PreparedToolCall } from '../types';
import { pushTraceWithDuration, startTraceTimer } from '../telemetry';

const buildToolInput = (action: PendingAction, state: AgentGraphState): Record<string, any> => {
    if (action.type === 'create_user_calendar_event') {
        return {
            userId: state.userId,
            ...action.params,
        };
    }

    if (action.type === 'write_user_schedule_entry') {
        return {
            userId: state.userId,
            entry: action.params,
        };
    }

    if (action.type === 'post_course_review') {
        return {
            courseId: action.params.courseCode,
            authorId: state.userId,
            authorName: 'Anonymous',
            authorAvatar: 'Student',
            rating: action.params.rating,
            difficulty: 3,
            content: action.params.content,
            semester: 'Current',
            isAnonymous: false,
        };
    }

    if (action.type === 'post_course_teaming') {
        return {
            courseId: action.params.courseCode,
            userId: state.userId,
            userName: 'Anonymous',
            userAvatar: 'Student',
            userMajor: 'Student',
            section: action.params.section,
            selfIntro: action.params.content,
            targetTeammate: action.params.content,
            contacts: [],
        };
    }

    if (action.type === 'send_course_chat_message') {
        return {
            courseId: action.params.courseCode,
            senderId: state.userId,
            content: action.params.content,
        };
    }

    return {};
};

const buildToolCalls = (state: AgentGraphState): PreparedToolCall[] => {
    if (!state.pendingAction) return [];

    return [
        {
            toolName: state.pendingAction.type,
            input: buildToolInput(state.pendingAction, state),
        },
    ];
};

export const executeToolsNode = async (state: AgentGraphState): Promise<AgentGraphState> => {
    const timer = startTraceTimer();
    const toolCalls = buildToolCalls(state);
    const results = [];

    for (const call of toolCalls) {
        if (call.toolName === 'create_user_calendar_event') {
            results.push(await createCalendarEventTool(call.input as any));
            continue;
        }

        if (call.toolName === 'write_user_schedule_entry') {
            results.push(await writeUserScheduleTool(call.input));
            continue;
        }

        if (call.toolName === 'post_course_review') {
            results.push(await postCourseReviewTool(call.input));
            continue;
        }

        if (call.toolName === 'post_course_teaming') {
            results.push(await postCourseTeamingTool(call.input));
            continue;
        }

        if (call.toolName === 'send_course_chat_message') {
            results.push(await sendCourseChatMessageTool(call.input as any));
        }
    }

    const toolTraceEntries = results.map(r => ({
        toolName: r.toolName,
        success: r.success,
        retryable: r.retryable,
    }));
    const allSucceeded = results.length > 0 && results.every(result => result.success);

    return pushTraceWithDuration(
        {
            ...state,
            pendingAction: allSucceeded ? null : state.pendingAction,
            toolCalls,
            toolResults: results,
        },
        'execute_tools',
        `executed=${results.length}, success=${results.filter(r => r.success).length}`,
        timer.startedAt,
        { toolCalls: toolTraceEntries }
    );
};

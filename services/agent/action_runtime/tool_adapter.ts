/**
 * Tool Adapter
 *
 * Maps PendingDraft to existing tool call inputs.
 * Reuses the same tool execution logic from the legacy graph.
 * See docs/agent/action-agent-migration.md §8.
 */

import type { ActionType, PendingDraft } from './types';
import { createCalendarEventTool } from '../graph/tools/calendar_tools';
import { writeUserScheduleTool } from '../graph/tools/schedule_tools';
import {
    postCourseReviewTool,
    postCourseTeamingTool,
    sendCourseChatMessageTool,
} from '../graph/tools/course_community_tools';
import { submitTeacherReview } from '../../teachers';

export type ToolCallInput = {
    toolName: string;
    input: Record<string, any>;
};

export type ToolCallResult = {
    success: boolean;
    error?: string;
};

export const buildToolCallFromDraft = (draft: PendingDraft, userId: string): ToolCallInput => {
    const d = draft.draft as Record<string, any>;

    switch (draft.actionType) {
        case 'post_course_review':
            return {
                toolName: 'post_course_review',
                input: {
                    courseId: d.courseCode,
                    authorId: userId,
                    authorName: 'Anonymous',
                    authorAvatar: 'Student',
                    rating: d.rating,
                    difficulty: d.difficulty ?? 3,
                    content: d.content,
                    semester: 'Current',
                    isAnonymous: d.anonymous ?? false,
                },
            };

        case 'post_teacher_review':
            return {
                toolName: 'post_teacher_review',
                input: {
                    teacherId: d.teacherId,
                    authorId: userId,
                    rating: d.rating,
                    difficulty: d.difficulty ?? 3,
                    workload: d.workload ?? 3,
                    content: d.content,
                    tags: d.tags ?? [],
                },
            };

        case 'post_course_teaming':
            return {
                toolName: 'post_course_teaming',
                input: {
                    courseId: d.courseCode,
                    userId,
                    userName: 'Anonymous',
                    userAvatar: 'Student',
                    userMajor: 'Student',
                    section: d.section,
                    selfIntro: d.content,
                    targetTeammate: d.content,
                    contacts: d.contactMethod ? [d.contactMethod] : [],
                },
            };

        case 'send_course_chat_message':
            return {
                toolName: 'send_course_chat_message',
                input: {
                    courseId: d.courseCode,
                    senderId: userId,
                    content: d.content,
                },
            };

        case 'create_user_calendar_event':
            return {
                toolName: 'create_user_calendar_event',
                input: {
                    userId,
                    title: d.title,
                    eventType: d.eventType,
                    eventDate: d.eventDate,
                    startTime: d.startTime,
                    endTime: d.endTime,
                    location: d.location,
                    note: d.note,
                    courseCode: d.courseCode,
                },
            };

        case 'write_user_schedule_entry':
            return {
                toolName: 'write_user_schedule_entry',
                input: {
                    userId,
                    entry: {
                        title: d.title,
                        courseCode: d.courseCode,
                        dayOfWeek: d.dayOfWeek,
                        startTime: d.startTime,
                        endTime: d.endTime,
                        room: d.room,
                        weekText: d.weekText,
                    },
                },
            };
    }
};

export const executeToolCall = async (
    toolName: string,
    input: Record<string, any>
): Promise<ToolCallResult> => {
    if (toolName === 'post_course_review') {
        const result = await postCourseReviewTool(input);
        return { success: result.success, error: result.resultSummary };
    }

    if (toolName === 'post_teacher_review') {
        try {
            await submitTeacherReview({
                teacherId: input.teacherId,
                authorId: input.authorId,
                rating: input.rating,
                difficulty: input.difficulty,
                workload: input.workload,
                content: input.content,
                tags: input.tags,
            });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error?.message || 'teacher review submission failed' };
        }
    }

    if (toolName === 'post_course_teaming') {
        const result = await postCourseTeamingTool(input);
        return { success: result.success, error: result.resultSummary };
    }

    if (toolName === 'send_course_chat_message') {
        const result = await sendCourseChatMessageTool(input as any);
        return { success: result.success, error: result.resultSummary };
    }

    if (toolName === 'create_user_calendar_event') {
        const result = await createCalendarEventTool(input as any);
        return { success: result.success, error: result.resultSummary };
    }

    if (toolName === 'write_user_schedule_entry') {
        const result = await writeUserScheduleTool(input);
        return { success: result.success, error: result.resultSummary };
    }

    throw new Error(`Unsupported action runtime tool: ${toolName}`);
};

/**
 * Action Agent
 *
 * LLM-driven action identification and field extraction.
 * Replaces the old plan_next_step -> prepare_action -> clarify_user chain
 * for write operations.
 * See docs/agent/action-agent-contract-and-flow.md §8 and migration doc §3.2.
 */

import i18n from '../../../app/i18n/i18n';
import { callDeepSeek } from '../llm';
import { supabase } from '../../supabase';
import type {
    ActionAgentInput,
    ActionAgentResult,
    ActionPayload,
    ActionType,
    PendingDraft,
    PostCourseReviewDraft,
    PostTeacherReviewDraft,
} from './types';
import {
    buildActionPayload,
    computeMissingFields,
    createDefaultDraft,
    buildSummary,
    createUiSchema,
} from './contract';
import { getPresetContentForRating } from './followup_router';
import { processFollowup, classifyFollowup } from './followup_router';
import { buildToolCallFromDraft } from './tool_adapter';
import { buildSuccessResult, buildFailureResult, buildCancelResult } from './template_response';

// ─── Add Course Modal Payload ──────────────────────────────────────

const buildAddCourseModalPayload = (
    courseCode: string,
    requestId: string,
    sessionId: string,
): ActionPayload => ({
    type: 'agent_action',
    version: '1.0',
    requestId,
    sessionId,
    message: {
        text: i18n.t('courses.course_not_found', { code: courseCode }),
        tone: 'warning',
    },
    action: {
        actionType: 'post_course_review',
        phase: 'draft',
        status: 'awaiting_user_input',
        canConfirm: false,
        canSubmit: false,
        canCancel: true,
        requiresConfirmation: false,
        missingFields: [],
        editableFields: [],
        draft: { courseCode, rating: null, content: '', anonymous: false },
        uiSchema: {
            surface: 'add_course_modal',
            title: i18n.t('courses.add_course.title'),
        },
        summary: { title: i18n.t('courses.add_course.title'), lines: [] },
    },
    next: {
        expectedUserAction: 'fill_or_edit_draft',
        allowedInputs: ['free_text', 'cancel'],
    },
    meta: { source: 'action_agent', latencyTier: 'fast' },
});

// ─── Action Type Detection (local, no LLM) ──────────────────────────

const ACTION_PATTERNS: Array<{ pattern: RegExp; actionType: ActionType }> = [
    // Teacher review MUST come before course review to take priority when "老师/教师/professor" is mentioned
    { pattern: /评价.*(老师|教师|教授|professor|prof)|(?:老师|教师|教授|professor|prof).*评价|(?:想|要|给.*写|帮我写|帮我发).*(?:老师|教师|教授).*评价|review.*(?:teacher|professor|prof)/i, actionType: 'post_teacher_review' },
    { pattern: /发.*评价|写.*评价|发布.*评价|(?:想|要|给.*写|帮我写|帮我发).*评价|评价.*课|评价一下|write.*review|post.*review/i, actionType: 'post_course_review' },
    { pattern: /组队|找队友|teaming|队友/i, actionType: 'post_course_teaming' },
    { pattern: /聊天室|群聊|发.*消息|chatroom|send.*message/i, actionType: 'send_course_chat_message' },
    { pattern: /日历|calendar|记.*日历|创建.*事件/i, actionType: 'create_user_calendar_event' },
    { pattern: /课表|schedule|记.*课表|写.*课表/i, actionType: 'write_user_schedule_entry' },
];

const IMPLICIT_REVIEW_PATTERNS = /^(评价|評價|review|写评价|寫評價|发评价|發評價)$|^(我要|我想|帮我|幫我).*(评价|評價|review)$/i;

export const detectActionType = (input: string): ActionType | null => {
    const explicitScheduleWrite = /(?:(?:帮我|替我|给我|添加|新增|记录|导入|写入|录入|保存|加到|放进|安排|记(?:一)?下|写(?:个|一下)?).*(?:课表|schedule)|(?:add|create|write|record|import|save)\s+(?:my\s+)?(?:class\s+)?schedule)/i;
    if (explicitScheduleWrite.test(input)) {
        return 'write_user_schedule_entry';
    }

    if (/(课表|schedule)/i.test(input)) {
        return null;
    }

    for (const { pattern, actionType } of ACTION_PATTERNS) {
        if (actionType === 'write_user_schedule_entry') continue;
        if (pattern.test(input)) return actionType;
    }
    return null;
};

// ─── LLM-based Field Extraction ─────────────────────────────────────

const buildExtractionPrompt = (actionType: ActionType, input: string): Array<{ role: string; content: string }> => [
    {
        role: 'system',
        content: `你是一个字段提取助手。用户想要执行 "${actionType}" 操作。
请从用户输入中提取相关字段，返回纯 JSON（不要 markdown 代码块）。

post_course_review 字段：
- courseCode: string | null (课程代码，如 COMP3015)
- rating: number | null (1-5 星)
- content: string (评价内容)
- anonymous: boolean (是否匿名，默认 false)

post_teacher_review 字段：
- teacherName: string | null (教师姓名，如 Dr. Chan, Prof. Lee)
- rating: number | null (1-5 星，总体评分)
- difficulty: number | null (1-5，难度)
- workload: number | null (1-5，工作量)
- content: string (评价内容)
- tags: string[] (标签数组，如 ["讲课清晰", "给分大方"])

post_course_teaming 字段：
- courseCode: string | null
- section: string (小组，如 A1)
- content: string (自我介绍)
- contactMethod: string (联系方式)

send_course_chat_message 字段：
- courseCode: string | null
- content: string (消息内容)

create_user_calendar_event 字段：
- title: string
- eventType: string (exam/quiz/assignment/custom)
- eventDate: string | null (YYYY-MM-DD)
- startTime: string | null (HH:MM)
- endTime: string | null (HH:MM)
- location: string
- note: string
- courseCode: string | null

write_user_schedule_entry 字段：
- title: string
- courseCode: string | null
- dayOfWeek: number | null (1-7)
- startTime: string | null (HH:MM)
- endTime: string | null (HH:MM)
- room: string
- weekText: string

只返回能从输入中提取到的字段，不要猜测。如果某个字段无法提取，不要包含在返回中。
返回格式：{"fieldName": "value", ...}`,
    },
    { role: 'user', content: input },
];

const extractFieldsViaLLM = async (
    actionType: ActionType,
    input: string
): Promise<Record<string, any>> => {
    try {
        const raw = await callDeepSeek(buildExtractionPrompt(actionType, input));
        // Try to parse JSON from the response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return {};
    } catch {
        return {};
    }
};

// ─── Preset Content Injection ────────────────────────────────────────

const injectPresetContent = (draft: PostCourseReviewDraft): PostCourseReviewDraft => {
    if (draft.rating != null && !draft.content) {
        const presets = getPresetContentForRating(draft.rating);
        if (presets.length > 0) {
            return { ...draft, content: presets[0] };
        }
    }
    return draft;
};

// ─── Course Lookup ──────────────────────────────────────────────────

const normalizeCourseCode = (value: string): string =>
    (value || '').toUpperCase().replace(/\s+/g, '');

const lookupCourse = async (courseCode: string): Promise<{ found: boolean; courseId?: string; courseName?: string }> => {
    const normalized = normalizeCourseCode(courseCode);
    if (!normalized) return { found: false };

    // Try by code
    const { data: byCode } = await supabase
        .from('courses')
        .select('id, code, name')
        .eq('code', normalized)
        .maybeSingle();

    if (byCode) {
        return { found: true, courseId: byCode.id, courseName: byCode.name };
    }

    // Try by ID
    const { data: byId } = await supabase
        .from('courses')
        .select('id, code, name')
        .eq('id', courseCode)
        .maybeSingle();

    if (byId) {
        return { found: true, courseId: byId.id, courseName: byId.name };
    }

    return { found: false };
};

// ─── Teacher Lookup ────────────────────────────────────────────────

const lookupTeacher = async (teacherName: string): Promise<{ found: boolean; teacherId?: string; teacherName?: string }> => {
    if (!teacherName) return { found: false };

    // Try exact name match (case-insensitive)
    const { data: exact } = await supabase
        .from('teachers')
        .select('id, name')
        .ilike('name', teacherName)
        .maybeSingle();

    if (exact) {
        return { found: true, teacherId: exact.id, teacherName: exact.name };
    }

    // Try fuzzy match (contains)
    const { data: fuzzy } = await supabase
        .from('teachers')
        .select('id, name')
        .ilike('name', `%${teacherName}%`)
        .limit(1)
        .maybeSingle();

    if (fuzzy) {
        return { found: true, teacherId: fuzzy.id, teacherName: fuzzy.name };
    }

    return { found: false };
};

// ─── Main Entry Point ───────────────────────────────────────────────

export const runActionAgent = async (
    input: ActionAgentInput,
    executeTool?: (toolName: string, toolInput: Record<string, any>) => Promise<{ success: boolean; error?: string }>
): Promise<ActionAgentResult> => {
    const { pendingDraft, requestId, sessionId } = input;

    // ─── Handle followup if there's a pending draft ─────────────────
    if (pendingDraft) {
        const followupKind = classifyFollowup(input.input);

        // Cancel
        if (followupKind === 'cancel') {
            return buildCancelResult(pendingDraft, requestId, sessionId);
        }

        // Confirm → execute tool
        if (followupKind === 'confirm') {
            const missingFields = computeMissingFields(pendingDraft.actionType, pendingDraft.draft);
            if (missingFields.length === 0) {
                if (executeTool) {
                    const toolCall = buildToolCallFromDraft(pendingDraft, input.userId);
                    try {
                        const result = await executeTool(toolCall.toolName, toolCall.input);
                        if (result.success) {
                            return buildSuccessResult(pendingDraft, requestId, sessionId);
                        }
                        return buildFailureResult(pendingDraft, requestId, sessionId, result.error);
                    } catch {
                        return buildFailureResult(pendingDraft, requestId, sessionId);
                    }
                }
                // No executor available, return confirm state
                return {
                    finalAnswer: '请确认是否发布这条课程评价。',
                    actionPayload: buildActionPayload({
                        actionType: pendingDraft.actionType,
                        draft: pendingDraft.draft,
                        requestId,
                        sessionId,
                        messageText: '请确认是否发布这条课程评价。',
                        phaseOverride: 'confirm',
                        statusOverride: 'ready_for_confirmation',
                    }),
                    pendingDraft,
                    toolExecuted: false,
                };
            }
        }

        // Free text → try slot filling
        const result = processFollowup(input.input, pendingDraft);
        if (result.updatedDraft) {
            const updated = result.updatedDraft;
            const missingFields = computeMissingFields(updated.actionType, updated.draft);

            // If all fields filled, move to confirm
            if (missingFields.length === 0) {
                const d = updated.draft as Record<string, any>;
                return {
                    finalAnswer: '参数已齐全，请确认是否提交。',
                    actionPayload: buildActionPayload({
                        actionType: updated.actionType,
                        draft: updated.draft,
                        requestId,
                        sessionId,
                        messageText: '参数已齐全，请确认是否提交。',
                        phaseOverride: 'confirm',
                        statusOverride: 'ready_for_confirmation',
                    }),
                    pendingDraft: updated,
                    toolExecuted: false,
                };
            }

            // Still missing fields
            const isBareNumber = /^\d{3,6}$/.test(input.input.trim()) && !/^[1-5]$/.test(input.input.trim());
            const missingLabels = missingFields.map(f => {
                if (f === 'courseCode') return isBareNumber ? '完整课程代码（如 COMP1006，数字代码可能对应多个课程）' : '课程代码';
                if (f === 'rating') return '评分';
                if (f === 'content') return '评价内容';
                return f;
            });
            const text = `还需要补充：${missingLabels.join('、')}`;
            return {
                finalAnswer: text,
                actionPayload: buildActionPayload({
                    actionType: updated.actionType,
                    draft: updated.draft,
                    requestId,
                    sessionId,
                    messageText: text,
                }),
                pendingDraft: updated,
                toolExecuted: false,
            };
        }

        // Cancel result
        return buildCancelResult(pendingDraft, requestId, sessionId);
    }

    // ─── New action request ─────────────────────────────────────────
    const implicitReview = !!input.sessionState.referencedCourse && IMPLICIT_REVIEW_PATTERNS.test(input.input.trim());
    const actionType = detectActionType(input.input) ?? (implicitReview ? 'post_course_review' : null);
    if (!actionType) {
        return {
            finalAnswer: '我暂时还不能处理这个写操作，请先改成课程评价、组队、课表或日历事件。',
            actionPayload: null,
            pendingDraft: null,
            toolExecuted: false,
        };
    }

    // Extract fields via LLM
    const extracted = await extractFieldsViaLLM(actionType, input.input);
    let draft = { ...createDefaultDraft(actionType), ...extracted } as any;

    // Inject preset content for reviews
    if (actionType === 'post_course_review') {
        if (!draft.courseCode && input.sessionState.referencedCourse) {
            draft.courseCode = input.sessionState.referencedCourse;
        }
        draft = injectPresetContent(draft);
    }

    // ─── Course verification for reviews ─────────────────────────────
    if (actionType === 'post_course_review') {
        const d = draft as PostCourseReviewDraft;

        // No course code → ask for it
        if (!d.courseCode) {
            const text = '请先告诉我你要评价的课程代码（如 COMP1006）';
            return {
                finalAnswer: text,
                actionPayload: buildActionPayload({
                    actionType,
                    draft,
                    requestId,
                    sessionId,
                    messageText: text,
                }),
                pendingDraft: {
                    actionType,
                    phase: 'draft',
                    status: 'awaiting_user_input',
                    draft,
                    missingFields: ['courseCode'],
                    uiSchema: createUiSchema(actionType, 'draft'),
                    summary: buildSummary(actionType, draft, 'draft'),
                    source: 'action_agent',
                    requestId,
                    sessionId,
                },
                toolExecuted: false,
            };
        }

        // Verify course exists
        const course = await lookupCourse(d.courseCode);
        if (!course.found) {
            const text = i18n.t('courses.course_not_found', { code: d.courseCode });
            return {
                finalAnswer: text,
                actionPayload: buildAddCourseModalPayload(d.courseCode!, requestId, sessionId),
                pendingDraft: null,
                toolExecuted: false,
            };
        }

        // Course found → lock course code, ask for remaining fields
        const verifiedDraft = { ...d, courseCode: normalizeCourseCode(d.courseCode) } as PostCourseReviewDraft;
        const missingFields = computeMissingFields('post_course_review', verifiedDraft);

        if (missingFields.length === 0) {
            // All fields present (e.g. user said "评价COMP1006 5星 很好") → go to confirm
            const text = `找到课程 ${course.courseName || verifiedDraft.courseCode}，请确认评价内容。`;
            return {
                finalAnswer: text,
                actionPayload: buildActionPayload({
                    actionType: 'post_course_review',
                    draft: verifiedDraft,
                    requestId,
                    sessionId,
                    messageText: text,
                    phaseOverride: 'confirm',
                    statusOverride: 'ready_for_confirmation',
                    courseLocked: true,
                    courseName: course.courseName ?? undefined,
                }),
                pendingDraft: {
                    actionType: 'post_course_review',
                    phase: 'confirm',
                    status: 'ready_for_confirmation',
                    draft: verifiedDraft,
                    missingFields: [],
                    uiSchema: createUiSchema('post_course_review', 'confirm'),
                    summary: buildSummary('post_course_review', verifiedDraft, 'confirm'),
                    source: 'action_agent',
                    requestId,
                    sessionId,
                },
                toolExecuted: false,
            };
        }

        // Course found but missing rating/content → show modal with locked course
        const text = `找到课程 ${course.courseName || verifiedDraft.courseCode}，请在弹窗中填写评分和评价内容。`;
        return {
            finalAnswer: text,
            actionPayload: buildActionPayload({
                actionType: 'post_course_review',
                draft: verifiedDraft,
                requestId,
                sessionId,
                messageText: text,
                courseLocked: true,
                courseName: course.courseName ?? undefined,
            }),
            pendingDraft: {
                actionType: 'post_course_review',
                phase: 'draft',
                status: 'awaiting_user_input',
                draft: verifiedDraft,
                missingFields,
                uiSchema: createUiSchema('post_course_review', 'draft', { courseLocked: true, courseName: course.courseName ?? undefined }),
                summary: buildSummary('post_course_review', verifiedDraft, 'draft'),
                source: 'action_agent',
                requestId,
                sessionId,
            },
            toolExecuted: false,
        };
    }

    // ─── Teacher review verification ──────────────────────────────────
    if (actionType === 'post_teacher_review') {
        const d = draft as PostTeacherReviewDraft;

        // No teacher name → ask for it
        if (!d.teacherName) {
            const text = '请先告诉我你要评价的教师姓名（如 Dr. Chan、李老师）';
            return {
                finalAnswer: text,
                actionPayload: buildActionPayload({
                    actionType,
                    draft,
                    requestId,
                    sessionId,
                    messageText: text,
                }),
                pendingDraft: {
                    actionType,
                    phase: 'draft',
                    status: 'awaiting_user_input',
                    draft,
                    missingFields: ['teacherName'],
                    uiSchema: createUiSchema(actionType, 'draft'),
                    summary: buildSummary(actionType, draft, 'draft'),
                    source: 'action_agent',
                    requestId,
                    sessionId,
                },
                toolExecuted: false,
            };
        }

        // Verify teacher exists in DB
        const teacher = await lookupTeacher(d.teacherName);
        if (!teacher.found) {
            const text = `未找到教师「${d.teacherName}」，请确认姓名是否正确，或检查拼写。`;
            return {
                finalAnswer: text,
                actionPayload: buildActionPayload({
                    actionType,
                    draft,
                    requestId,
                    sessionId,
                    messageText: text,
                    messageTone: 'warning',
                }),
                pendingDraft: {
                    actionType,
                    phase: 'draft',
                    status: 'awaiting_user_input',
                    draft,
                    missingFields: ['teacherName'],
                    uiSchema: createUiSchema(actionType, 'draft'),
                    summary: buildSummary(actionType, draft, 'draft'),
                    source: 'action_agent',
                    requestId,
                    sessionId,
                },
                toolExecuted: false,
            };
        }

        // Teacher found → lock teacherId
        const verifiedDraft = { ...d, teacherId: teacher.teacherId, teacherName: teacher.teacherName } as PostTeacherReviewDraft;
        const teacherMissing = computeMissingFields('post_teacher_review', verifiedDraft);

        if (teacherMissing.length === 0) {
            const text = `找到教师 ${teacher.teacherName}，请确认评价内容。`;
            return {
                finalAnswer: text,
                actionPayload: buildActionPayload({
                    actionType: 'post_teacher_review',
                    draft: verifiedDraft,
                    requestId,
                    sessionId,
                    messageText: text,
                    phaseOverride: 'confirm',
                    statusOverride: 'ready_for_confirmation',
                    teacherLocked: true,
                    teacherName: teacher.teacherName,
                }),
                pendingDraft: {
                    actionType: 'post_teacher_review',
                    phase: 'confirm',
                    status: 'ready_for_confirmation',
                    draft: verifiedDraft,
                    missingFields: [],
                    uiSchema: createUiSchema('post_teacher_review', 'confirm'),
                    summary: buildSummary('post_teacher_review', verifiedDraft, 'confirm'),
                    source: 'action_agent',
                    requestId,
                    sessionId,
                },
                toolExecuted: false,
            };
        }

        // Teacher found but missing rating/content → show modal
        const text = `找到教师 ${teacher.teacherName}，请在弹窗中填写评分和评价内容。`;
        return {
            finalAnswer: text,
            actionPayload: buildActionPayload({
                actionType: 'post_teacher_review',
                draft: verifiedDraft,
                requestId,
                sessionId,
                messageText: text,
                teacherLocked: true,
                teacherName: teacher.teacherName,
            }),
            pendingDraft: {
                actionType: 'post_teacher_review',
                phase: 'draft',
                status: 'awaiting_user_input',
                draft: verifiedDraft,
                missingFields: teacherMissing,
                uiSchema: createUiSchema('post_teacher_review', 'draft', { teacherLocked: true, teacherName: teacher.teacherName }),
                summary: buildSummary('post_teacher_review', verifiedDraft, 'draft'),
                source: 'action_agent',
                requestId,
                sessionId,
            },
            toolExecuted: false,
        };
    }

    // ─── Non-review action types ────────────────────────────────────
    const missingFields = computeMissingFields(actionType, draft);
    const summary = buildSummary(actionType, draft, 'draft');

    const newPendingDraft: PendingDraft = {
        actionType,
        phase: 'draft',
        status: 'awaiting_user_input',
        draft,
        missingFields,
        uiSchema: createUiSchema(actionType, 'draft'),
        summary,
        source: 'action_agent',
        requestId,
        sessionId,
    };

    const text = missingFields.length > 0
        ? `我可以帮你${actionType === 'post_course_teaming' ? '发组队信息' : actionType === 'send_course_chat_message' ? '发消息' : actionType === 'create_user_calendar_event' ? '创建日历事件' : '写课表'}，还需要补充：${missingFields.map(f => f === 'courseCode' ? '课程代码' : f === 'rating' ? '评分' : f === 'content' ? '评价内容' : f).join('、')}`
        : '参数已齐全，请确认是否提交。';

    return {
        finalAnswer: text,
        actionPayload: buildActionPayload({
            actionType,
            draft,
            requestId,
            sessionId,
            messageText: text,
        }),
        pendingDraft: newPendingDraft,
        toolExecuted: false,
    };
};

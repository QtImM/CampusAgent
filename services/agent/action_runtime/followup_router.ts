/**
 * Followup Router
 *
 * Handles pending draft follow-ups (slot filling, confirm, cancel, field edits)
 * WITHOUT going through the planner or LLM.
 * See docs/agent/action-agent-contract-and-flow.md §12 and migration doc §3.2.
 */

import type { ActionDraft, ActionType, PendingDraft, PostCourseReviewDraft, PostTeacherReviewDraft } from './types';
import { computeMissingFields, REVIEW_PRESETS, buildSummary } from './contract';

export type FollowupKind = 'cancel' | 'confirm' | 'field_edit' | 'free_text' | 'unknown';

const CANCEL_PATTERNS = /^(取消|算了|不用了|先不用|停止|cancel|never mind)$/i;
const CONFIRM_PATTERNS = /^(确认|可以|是的|yes|ok|okay|confirm|好)$/i;

export const classifyFollowup = (input: string): FollowupKind => {
    const trimmed = input.trim();
    if (CANCEL_PATTERNS.test(trimmed)) return 'cancel';
    if (CONFIRM_PATTERNS.test(trimmed)) return 'confirm';
    if (trimmed.length >= 2 && trimmed.length <= 240) return 'free_text';
    return 'unknown';
};

const extractCourseCode = (value: string): string | undefined => {
    // Standard format: COMP3015, COMP 3015A
    const alphaMatch = value.toUpperCase().match(/\b([A-Z]{2,6}\s?\d{4}[A-Z]?)\b/);
    if (alphaMatch) return alphaMatch[1].replace(/\s+/g, '');
    // Bare number not accepted to avoid ambiguity (e.g. 1006 could be COMP1006, GENH1006)
    return undefined;
};

/** Check if input looks like a bare course number without department prefix */
const isBareCourseNumber = (value: string): boolean => {
    const trimmed = value.trim();
    return /^\d{3,6}$/.test(trimmed) && !/^[1-5]$/.test(trimmed);
};

const extractRating = (value: string): number | undefined => {
    const englishMatch = value.match(/\b([1-5])\s*(?:stars?)\b/i);
    if (englishMatch) return Number(englishMatch[1]);

    const chineseMatch = value.match(/(^|[^\d])([1-5])\s*星/);
    if (chineseMatch) return Number(chineseMatch[2]);

    const standaloneMatch = value.trim().match(/^([1-5])$/);
    return standaloneMatch ? Number(standaloneMatch[1]) : undefined;
};

const extractReviewContent = (value: string): string | undefined => {
    const parts = value
        .split(/\r?\n|[,，]/)
        .map(item => item.trim())
        .filter(Boolean);

    const remaining = parts.filter(item => !extractCourseCode(item) && !extractRating(item));
    if (remaining.length === 0) return undefined;

    const joined = remaining.join(' ').trim();
    return joined || undefined;
};

const fillReviewDraft = (existing: PostCourseReviewDraft, input: string): PostCourseReviewDraft => {
    const courseCode = extractCourseCode(input) ?? existing.courseCode;
    const rating = extractRating(input) ?? existing.rating;
    const extractedContent = extractReviewContent(input);
    const content = extractedContent
        ? extractedContent
        : (!existing.content && input.length >= 2 && input.length <= 240 && !extractCourseCode(input) && !extractRating(input))
            ? input.trim()
            : existing.content;

    return { ...existing, courseCode, rating, content };
};

const fillTeacherReviewDraft = (existing: PostTeacherReviewDraft, input: string): PostTeacherReviewDraft => {
    const rating = extractRating(input) ?? existing.rating;
    // If input is not a rating, treat it as content
    const extractedContent = extractReviewContent(input);
    const content = extractedContent
        ? extractedContent
        : (!existing.content && input.length >= 2 && input.length <= 240 && !extractRating(input))
            ? input.trim()
            : existing.content;

    return { ...existing, rating, content };
};

const fillDraftByActionType = (actionType: ActionType, draft: ActionDraft, input: string): ActionDraft => {
    switch (actionType) {
        case 'post_course_review':
            return fillReviewDraft(draft as PostCourseReviewDraft, input);
        case 'post_teacher_review':
            return fillTeacherReviewDraft(draft as PostTeacherReviewDraft, input);
        default:
            return draft;
    }
};

export const getPresetContentForRating = (rating: number): string[] => {
    const key = String(rating) as keyof typeof REVIEW_PRESETS.ratingToContentTemplates;
    return REVIEW_PRESETS.ratingToContentTemplates[key] || [];
};

export type FollowupResult = {
    kind: FollowupKind;
    updatedDraft: PendingDraft | null;
};

export const processFollowup = (
    input: string,
    pendingDraft: PendingDraft
): FollowupResult => {
    const kind = classifyFollowup(input);

    if (kind === 'cancel') {
        return { kind, updatedDraft: null };
    }

    if (kind === 'confirm') {
        const missingFields = computeMissingFields(pendingDraft.actionType, pendingDraft.draft);
        if (missingFields.length === 0) {
            return { kind, updatedDraft: pendingDraft };
        }
    }

    const updated = fillDraftByActionType(pendingDraft.actionType, pendingDraft.draft, input);
    const newMissing = computeMissingFields(pendingDraft.actionType, updated);

    return {
        kind: kind === 'confirm' ? 'free_text' : kind,
        updatedDraft: {
            ...pendingDraft,
            draft: updated,
            missingFields: newMissing,
            summary: buildSummary(pendingDraft.actionType, updated, 'draft'),
        },
    };
};

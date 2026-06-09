import { Review } from '../types';
import { supabase } from './supabase';

// Node-compatible courses service (subset used by the agent's tools).
// Resolves a course by code to its DB id, then inserts into `course_reviews`.

const resolveCourseId = async (courseIdOrCode?: string): Promise<string | null> => {
    if (!courseIdOrCode) return null;

    // If it already looks like a UUID, trust it.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(courseIdOrCode)) return courseIdOrCode;

    const code = courseIdOrCode.toUpperCase().replace(/\s+/g, '');
    const { data } = await supabase
        .from('courses')
        .select('id, code')
        .ilike('code', `%${code}%`)
        .limit(1)
        .maybeSingle();

    return data?.id || null;
};

export const addReview = async (reviewData: Partial<Review>): Promise<{ error: any }> => {
    const resolvedCourseId = await resolveCourseId(reviewData.courseId);
    const courseId = resolvedCourseId || reviewData.courseId;

    const { error } = await supabase
        .from('course_reviews')
        .insert({
            course_id: courseId,
            author_id: reviewData.authorId,
            author_name: reviewData.authorName,
            author_avatar: reviewData.authorAvatar,
            rating: reviewData.rating,
            difficulty: reviewData.difficulty,
            content: reviewData.content,
            semester: reviewData.semester,
            is_anonymous: reviewData.isAnonymous || false,
        });

    return { error };
};

import { CourseTeaming } from '../types';
import { supabase } from './supabase';

// Node-compatible teaming service (subset used by the agent's tools).
const TEAMING_TABLE = 'course_teaming';

const resolveCourseId = async (courseIdOrCode?: string): Promise<string | null> => {
    if (!courseIdOrCode) return null;
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

export const postTeamingRequest = async (
    request: Partial<CourseTeaming>
): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
        const resolvedCourseId = await resolveCourseId(request.courseId);
        if (!resolvedCourseId) {
            return { success: false, error: 'Invalid course.' };
        }

        const teamingData = {
            course_id: resolvedCourseId,
            user_id: request.userId,
            user_name: request.userName,
            user_avatar: request.userAvatar || '👤',
            user_major: request.userMajor,
            section: request.section,
            self_intro: request.selfIntro,
            target_teammate: request.targetTeammate,
            contacts: request.contacts,
            status: 'open',
            likes: 0,
            comment_count: 0,
        };

        const { data, error } = await supabase
            .from(TEAMING_TABLE)
            .insert(teamingData)
            .select()
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Unknown error' };
    }
};

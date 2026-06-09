import { supabase } from './supabase';

// Node-compatible calendar service (subset used by the agent's tools).
// Writes to the real `user_calendar_events` table.

export interface CreateUserCalendarEventInput {
    userId: string;
    title: string;
    eventType: 'exam' | 'quiz' | 'assignment' | 'custom';
    eventDate: string;
    courseCode?: string;
    matchedCourseId?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    note?: string;
}

export const createUserCalendarEvent = async (
    input: CreateUserCalendarEventInput
): Promise<{ data: any | null; error: string | null }> => {
    if (!input.title || !input.title.trim()) {
        return { data: null, error: 'Title is required' };
    }
    if (!input.eventDate) {
        return { data: null, error: 'Event date is required' };
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(input.eventDate)) {
        return { data: null, error: 'Event date must be in YYYY-MM-DD format' };
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (input.startTime && !timeRegex.test(input.startTime)) {
        return { data: null, error: 'Start time must be in HH:MM format' };
    }
    if (input.endTime && !timeRegex.test(input.endTime)) {
        return { data: null, error: 'End time must be in HH:MM format' };
    }

    const { data, error } = await supabase
        .from('user_calendar_events')
        .insert({
            user_id: input.userId,
            title: input.title.trim(),
            event_type: input.eventType,
            course_code: input.courseCode || null,
            matched_course_id: input.matchedCourseId || null,
            event_date: input.eventDate,
            start_time: input.startTime || null,
            end_time: input.endTime || null,
            location: input.location || null,
            note: input.note || null,
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }
    return { data, error: null };
};

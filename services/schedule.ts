import { supabase } from './supabase';

// Node-compatible schedule service (subset used by the agent's tools).
// Reads/writes the real `user_schedule_entries` table.

export interface UserScheduleEntry {
    id: string;
    userId: string;
    title: string;
    courseCode?: string;
    teacherName?: string;
    room?: string;
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
    startPeriod?: number;
    endPeriod?: number;
    weekText?: string;
    matchedCourseId?: string;
    source: 'ocr' | 'manual_search' | 'manual_custom';
    isActive: boolean;
}

export interface UpdateUserScheduleEntryInput {
    title: string;
    courseCode?: string;
    teacherName?: string;
    room?: string;
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
    startPeriod?: number;
    endPeriod?: number;
    weekText?: string;
}

const mapEntryRow = (row: any): UserScheduleEntry => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    courseCode: row.course_code || undefined,
    teacherName: row.teacher_name || undefined,
    room: row.room || undefined,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    startPeriod: row.start_period || undefined,
    endPeriod: row.end_period || undefined,
    weekText: row.week_text || undefined,
    matchedCourseId: row.matched_course_id || undefined,
    source: row.source,
    isActive: row.is_active,
});

export const getUserScheduleEntries = async (
    userId: string,
    _options?: { forceRefresh?: boolean; allowStaleOnError?: boolean }
): Promise<UserScheduleEntry[]> => {
    const { data, error } = await supabase
        .from('user_schedule_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })
        .order('start_period', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapEntryRow);
};

export const createManualScheduleEntry = async (params: {
    userId: string;
    entry: UpdateUserScheduleEntryInput;
}): Promise<UserScheduleEntry> => {
    const { userId, entry } = params;

    if (!entry.title.trim()) {
        throw new Error('Missing course title.');
    }

    const hasTime = Boolean(entry.startTime && entry.endTime);
    const hasPeriod = Boolean(entry.startPeriod && entry.endPeriod);
    const hasWeekText = Boolean(entry.weekText);
    if (!hasTime && !hasPeriod && !hasWeekText) {
        throw new Error('Missing extracted class time.');
    }

    const { data, error } = await supabase
        .from('user_schedule_entries')
        .insert({
            user_id: userId,
            source: 'manual_custom',
            title: entry.title.trim(),
            course_code: entry.courseCode?.trim() || null,
            teacher_name: entry.teacherName?.trim() || null,
            room: entry.room?.trim() || null,
            day_of_week: entry.dayOfWeek,
            start_time: entry.startTime?.trim() || null,
            end_time: entry.endTime?.trim() || null,
            start_period: entry.startPeriod || null,
            end_period: entry.endPeriod || null,
            week_text: entry.weekText?.trim() || null,
        })
        .select('*')
        .single();

    if (error) throw error;
    return mapEntryRow(data);
};

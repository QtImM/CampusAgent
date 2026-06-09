import { createUserCalendarEvent } from '../../../calendar';

export const createCalendarEventTool = async (input: {
    title: string;
    eventType: 'exam' | 'quiz' | 'assignment' | 'custom';
    eventDate: string;
    courseCode?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    note?: string;
}) => {
    const result = await createUserCalendarEvent(input as any);
    return {
        toolName: 'create_user_calendar_event',
        success: !result.error,
        resultSummary: result.error || 'calendar event created',
        rawResult: result,
        retryable: Boolean(result.error),
    };
};

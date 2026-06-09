import { createManualScheduleEntry, getUserScheduleEntries } from '../../../schedule';

export const readUserScheduleTool = async (userId: string) => {
    const entries = await getUserScheduleEntries(userId, { allowStaleOnError: true });
    return {
        toolName: 'read_user_schedule',
        success: true,
        resultSummary: `loaded ${entries.length} schedule entries`,
        rawResult: entries,
        retryable: false,
    };
};

export const writeUserScheduleTool = async (input: any) => {
    const entry = await createManualScheduleEntry(input);
    return {
        toolName: 'write_user_schedule_entry',
        success: true,
        resultSummary: 'schedule entry created',
        rawResult: entry,
        retryable: false,
    };
};

import { addReview } from '../../../courses';
import { postTeamingRequest } from '../../../teaming';
import { supabase } from '../../../supabase';

export const postCourseReviewTool = async (input: any) => {
    const result = await addReview(input);
    return {
        toolName: 'post_course_review',
        success: !result.error,
        resultSummary: result.error ? result.error.message || 'review post failed' : 'review posted',
        rawResult: result,
        retryable: Boolean(result.error),
    };
};

export const postCourseTeamingTool = async (input: any) => {
    const result = await postTeamingRequest(input);
    return {
        toolName: 'post_course_teaming',
        success: result.success,
        resultSummary: result.success ? 'teaming post published' : result.error || 'teaming post failed',
        rawResult: result,
        retryable: !result.success,
    };
};

export const sendCourseChatMessageTool = async (input: {
    courseId: string;
    senderId: string;
    content: string;
}) => {
    const { error } = await supabase.from('messages').insert({
        course_id: input.courseId,
        sender_id: input.senderId,
        content: input.content,
    });

    return {
        toolName: 'send_course_chat_message',
        success: !error,
        resultSummary: error ? error.message || 'chat message failed' : 'chat message sent',
        rawResult: { error },
        retryable: Boolean(error),
    };
};

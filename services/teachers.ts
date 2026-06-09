import { TeacherReview } from '../types';
import { supabase } from './supabase';

// Node-compatible teachers service (subset used by the agent's tools).
// Writes to the real `teacher_reviews` table.
export const submitTeacherReview = async (review: Partial<TeacherReview>) => {
    const { data, error } = await supabase
        .from('teacher_reviews')
        .insert([{
            teacher_id: review.teacherId,
            author_id: review.authorId,
            author_name: '匿名的同学',
            author_avatar: null,
            rating: review.rating,
            difficulty: review.difficulty,
            workload: review.workload,
            content: review.content,
            tags: review.tags || [],
        }])
        .select()
        .single();

    if (error) {
        console.error('Error submitting teacher review:', error);
        throw error;
    }

    return data;
};

import { supabase } from '../supabase';

/**
 * Memory service for the Campus Life Agent.
 * Stores and retrieves persistent facts about the user.
 */
const isMissingAgentMemoryTable = (error: any): boolean => {
    if (!error) return false;
    const code = String(error.code || '');
    const message = String(error.message || '').toLowerCase();
    return code === 'PGRST205' || message.includes('agent_memory');
};

let hasWarnedMissingAgentMemoryTable = false;

const warnMissingAgentMemoryTableOnce = () => {
    if (hasWarnedMissingAgentMemoryTable) return;
    hasWarnedMissingAgentMemoryTable = true;
    console.warn('[Memory] agent_memory table missing; memory persistence disabled (reads return empty, writes skipped).');
};

export const getMemoryFact = async (userId: string, key: string) => {
    const { data, error } = await supabase
        .from('agent_memory')
        .select('fact_value')
        .eq('user_id', userId)
        .eq('fact_key', key)
        .single();

    if (error) {
        if (isMissingAgentMemoryTable(error)) {
            warnMissingAgentMemoryTableOnce();
            return null;
        }
        console.warn(`[Memory] Fact not found for key: ${key}`, error);
        return null;
    }
    return data?.fact_value;
};

export const saveMemoryFact = async (userId: string, key: string, value: any) => {
    const { error } = await supabase
        .from('agent_memory')
        .upsert({
            user_id: userId,
            fact_key: key,
            fact_value: value,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,fact_key' });

    if (error) {
        if (isMissingAgentMemoryTable(error)) {
            warnMissingAgentMemoryTableOnce();
            return;
        }
        console.error(`[Memory] Failed to save fact for key: ${key}`, error);
        throw error;
    }
};

export const getAllUserFacts = async (userId: string) => {
    const { data, error } = await supabase
        .from('agent_memory')
        .select('fact_key, fact_value')
        .eq('user_id', userId);

    if (error) {
        if (isMissingAgentMemoryTable(error)) {
            warnMissingAgentMemoryTableOnce();
            return {};
        }
        console.error('[Memory] Failed to fetch all facts', error);
        return {};
    }

    return data.reduce((acc, curr) => {
        acc[curr.fact_key] = curr.fact_value;
        return acc;
    }, {} as Record<string, any>);
};

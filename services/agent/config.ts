/**
 * Agent Configuration
 * For production, these should be moved to .env (EXPO_PUBLIC_*)
 */
const rawDeepSeekApiKey = (process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '').trim();

const parseBooleanFlag = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value == null || value.trim() === '') return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
};

const looksLikePlaceholderKey = (key: string): boolean => {
    if (!key) return true;
    const normalized = key.toLowerCase();
    return (
        normalized === 'your_deepseek_api_key' ||
        normalized === 'your_api_key_here' ||
        normalized.includes('your_') ||
        normalized.includes('placeholder')
    );
};

export const AGENT_CONFIG = {
    DEEPSEEK_API_KEY: rawDeepSeekApiKey,
    DEEPSEEK_BASE_URL: process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    FAST_MODEL: process.env.EXPO_PUBLIC_AGENT_FAST_MODEL || 'deepseek-v4-flash',
    REASONING_MODEL:
        process.env.EXPO_PUBLIC_AGENT_REASONING_MODEL ||
        process.env.EXPO_PUBLIC_AGENT_FAST_MODEL ||
        'deepseek-v4-pro',
    DEEPSEEK_ENABLED: !looksLikePlaceholderKey(rawDeepSeekApiKey),
    ACTION_AGENT_ENABLED: parseBooleanFlag(process.env.EXPO_PUBLIC_ACTION_AGENT_ENABLED, true),
    ACTION_AGENT_REVIEW_MODAL_ENABLED: parseBooleanFlag(process.env.EXPO_PUBLIC_ACTION_AGENT_REVIEW_MODAL_ENABLED, true),
    REACT_RUNTIME_ENABLED: parseBooleanFlag(process.env.EXPO_PUBLIC_REACT_RUNTIME_ENABLED, true),
    REACT_MAX_ITERATIONS: parseInt(process.env.EXPO_PUBLIC_REACT_MAX_ITERATIONS || '5', 10),
    REACT_TIMEOUT_MS: parseInt(process.env.EXPO_PUBLIC_REACT_TIMEOUT_MS || '30000', 10),
    IS_PROD: false, // Set to true to use real backend proxy in future
};

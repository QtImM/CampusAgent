import { callDeepSeek, resolveModelName } from './llm';
import type {
    AcceptedMemoryWrite,
    AgentHistoryItem,
    DurableMemoryType,
    MemoryCandidate,
    MemoryCandidateType,
} from './types';

const MEMORY_CONFIDENCE_THRESHOLD = 0.75;
const MAX_MEMORY_VALUE_LENGTH = 160;

const GENERIC_KEYS = new Set(['data', 'info', 'memory', 'thing', 'user_data']);

const CANONICAL_KEY_MAP: Record<string, string> = {
    call_me_name: 'nickname',
    exchange_plan: 'future_plan.exchange',
    exchange_plan_next_term: 'future_plan.exchange',
    favorite_food: 'favorite_food',
    food_like: 'favorite_food',
    food_preference: 'favorite_food',
    preferred_name: 'nickname',
    nickname: 'nickname',
    study_abroad_plan: 'future_plan.exchange',
};

const ALLOWED_TYPES = new Set<DurableMemoryType>([
    'background_fact',
    'long_term_preference',
]);

const SENSITIVE_VALUE_PATTERN =
    /\b\d{15,19}\b|\b(?:password|bank|passport|ssn|social security|credit card|card number)\b/i;

type ExtractionInput = {
    recentTurns: AgentHistoryItem[];
};

const ALLOWED_MEMORY_CANDIDATE_TYPES = new Set<MemoryCandidateType>([
    'long_term_preference',
    'background_fact',
    'emotion',
    'temporary_context',
    'unknown',
]);

const normalizeKeyShape = (rawKey: string): string => {
    return rawKey
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9._-]/g, '');
};

const isGenericKey = (normalizedKey: string): boolean => {
    return GENERIC_KEYS.has(normalizedKey);
};

const isSensitiveValue = (value: string): boolean => {
    return SENSITIVE_VALUE_PATTERN.test(value);
};

const isDurableMemoryType = (type: MemoryCandidate['memory_type']): type is DurableMemoryType => {
    return ALLOWED_TYPES.has(type as DurableMemoryType);
};

const extractFirstJsonObject = (raw: string): string | null => {
    let depth = 0;
    let startIndex = -1;
    let inString = false;
    let isEscaped = false;

    for (let index = 0; index < raw.length; index += 1) {
        const char = raw[index];

        if (startIndex === -1) {
            if (char === '{') {
                startIndex = index;
                depth = 1;
                inString = false;
                isEscaped = false;
            }
            continue;
        }

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }

            if (char === '\\') {
                isEscaped = true;
                continue;
            }

            if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            depth += 1;
            continue;
        }

        if (char === '}') {
            depth -= 1;

            if (depth === 0) {
                return raw.slice(startIndex, index + 1);
            }
        }
    }

    return null;
};

const parseJsonObject = (raw: string): unknown => {
    const trimmed = raw.trim();
    const withoutFence = trimmed.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();

    try {
        return JSON.parse(withoutFence);
    } catch {
        const extractedObject = extractFirstJsonObject(withoutFence);
        if (!extractedObject) {
            throw new Error('No JSON object found in LLM response');
        }

        return JSON.parse(extractedObject);
    }
};

const isMemoryCandidate = (value: unknown): value is MemoryCandidate => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<MemoryCandidate>;

    return (
        typeof candidate.should_store === 'boolean' &&
        typeof candidate.key === 'string' &&
        typeof candidate.value === 'string' &&
        typeof candidate.memory_type === 'string' &&
        ALLOWED_MEMORY_CANDIDATE_TYPES.has(candidate.memory_type as MemoryCandidateType) &&
        typeof candidate.confidence === 'number' &&
        Number.isFinite(candidate.confidence) &&
        candidate.confidence >= 0 &&
        candidate.confidence <= 1 &&
        typeof candidate.reason === 'string'
    );
};

const buildExtractionPrompt = (input: ExtractionInput): { role: string; content: string }[] => {
    const transcript = input.recentTurns
        .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
        .join('\n');

    return [
        {
            role: 'system',
            content: [
                'You extract durable user memory candidates from a conversation.',
                'Return JSON only.',
                'The JSON must contain a top-level "candidates" array.',
                'Each candidate must include should_store, key, value, memory_type, confidence, and reason.',
                'Use memory_type values from: long_term_preference, background_fact, emotion, temporary_context, unknown.',
                'Prefer durable preferences and background facts.',
                'Do not invent facts.',
                'Mark temporary context, emotions, and sensitive details as should_store false when present.',
            ].join(' '),
        },
        {
            role: 'user',
            content: `Recent conversation:\n${transcript}`,
        },
    ];
};

export const extractMemoryCandidatesFromConversation = async (
    input: ExtractionInput
): Promise<MemoryCandidate[]> => {
    if (input.recentTurns.length === 0) {
        return [];
    }

    const raw = await callDeepSeek(buildExtractionPrompt(input), {
        model: resolveModelName('fast'),
    });

    let parsed: unknown;
    try {
        parsed = parseJsonObject(raw);
    } catch {
        return [];
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { candidates?: unknown }).candidates)) {
        return [];
    }

    return (parsed as { candidates: unknown[] }).candidates.filter(isMemoryCandidate);
};

export const normalizeMemoryKey = (rawKey: string): string | null => {
    const normalizedKey = normalizeKeyShape(rawKey);

    if (!normalizedKey || normalizedKey.length < 2 || normalizedKey.length > 64) {
        return null;
    }

    if (isGenericKey(normalizedKey)) {
        return null;
    }

    return CANONICAL_KEY_MAP[normalizedKey] ?? normalizedKey;
};

export const filterMemoryCandidates = (
    candidates: MemoryCandidate[],
    existingFacts: Record<string, string>
): AcceptedMemoryWrite[] => {
    const accepted: AcceptedMemoryWrite[] = [];
    const acceptedPairs = new Set<string>();
    const acceptedKeys = new Set<string>();

    for (const candidate of candidates) {
        if (!candidate.should_store) {
            continue;
        }

        if (!isDurableMemoryType(candidate.memory_type)) {
            continue;
        }

        if (candidate.confidence < MEMORY_CONFIDENCE_THRESHOLD) {
            continue;
        }

        const normalizedKey = normalizeMemoryKey(candidate.key);
        const normalizedValue = candidate.value.trim();

        if (!normalizedKey || !normalizedValue) {
            continue;
        }

        if (normalizedValue.length > MAX_MEMORY_VALUE_LENGTH) {
            continue;
        }

        if (isSensitiveValue(normalizedValue)) {
            continue;
        }

        if (existingFacts[normalizedKey] === normalizedValue) {
            continue;
        }

        if (acceptedKeys.has(normalizedKey)) {
            continue;
        }

        const acceptedPairKey = `${normalizedKey}::${normalizedValue}`;
        if (acceptedPairs.has(acceptedPairKey)) {
            continue;
        }

        acceptedPairs.add(acceptedPairKey);
        acceptedKeys.add(normalizedKey);
        accepted.push({
            should_store: true,
            key: normalizedKey,
            value: normalizedValue,
            memoryType: candidate.memory_type,
            confidence: candidate.confidence,
            reason: candidate.reason,
        });

        if (accepted.length >= 3) {
            break;
        }
    }

    return accepted;
};

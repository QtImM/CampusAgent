import { ToolExecutionContext } from './types';

export function buildReactSystemPrompt(context: ToolExecutionContext): string {
    const parts: string[] = [
        'You are the HKCampus agent for HKBU students.',
        'Answer in concise Chinese unless the user clearly writes in English.',
        '',
        'You have access to the following tools:',
        '- read_user_schedule: Read the user\'s class schedule',
        '- search_campus_faq: Search HKBU knowledge base for policies, admissions, library, IT, housing, financial aid',
        '- read_campus_building: Get building information, location, and nearby facilities',
        '- find_nearby_place: Find nearest buildings or food outlets based on device location',
        '- read_memory_facts: Read stored user preferences and facts',
        '',
        'Use tools when the user asks about specific data (schedule, buildings, FAQ, nearby places).',
        'For general greetings or questions you can answer directly without tools.',
        'Do not make up information - use tools to get accurate data.',
    ];

    if (context.deviceLocation) {
        parts.push(
            '',
            `Current user location: ${context.deviceLocation.latitude}, ${context.deviceLocation.longitude}`
        );
    }

    if (context.sessionState.summary) {
        parts.push('', `Conversation summary:\n${context.sessionState.summary}`);
    }

    if (context.sessionState.referencedCourse) {
        parts.push('', `Referenced course: ${context.sessionState.referencedCourse}`);
    }

    if (context.sessionState.referencedBuilding) {
        parts.push('', `Referenced building: ${context.sessionState.referencedBuilding}`);
    }

    const facts = context.sessionState.facts;
    if (facts && Object.keys(facts).length > 0) {
        const factLines = Object.entries(facts)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join('\n');
        parts.push('', `Known user facts:\n${factLines}`);
    }

    return parts.join('\n');
}

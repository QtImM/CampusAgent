import { ToolSchema, ToolResult, ToolExecutionContext } from './types';
import { readUserScheduleTool } from '../graph/tools/schedule_tools';
import { searchCampusFaqTool } from '../graph/tools/faq_tools';
import { readCampusBuildingTool, findNearbyPlaceTool } from '../graph/tools/campus_lookup_tools';
import { readMemoryFactsTool } from '../graph/tools/memory_tools';

// ─── Tool Schemas for DeepSeek Function Calling ─────────────────────────────

export const REACT_TOOL_SCHEMAS: ToolSchema[] = [
    {
        type: 'function',
        function: {
            name: 'read_user_schedule',
            description: 'Read the current user schedule for queries like today classes, next class, or classes on a specific weekday.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The user request about their personal schedule, in Chinese or English.',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_campus_faq',
            description: 'Search the official HKBU knowledge base for questions about admissions, library policies, IT services, housing, and financial aid.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The user search query in English or Chinese.',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_campus_building',
            description: 'Read HKBU building information such as location, description, and nearby facilities for a named building or building code.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The user request about a building, such as AAB, WLB, library building, or where a building is.',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'find_nearby_place',
            description: 'Use the current device location to find the nearest HKBU building or food outlet.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The user request about nearby buildings, restaurants, canteens, or current location.',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_memory_facts',
            description: 'Read stored user preferences and facts from memory, such as nickname, major, residence hall, and favorite food.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
];

// ─── Tool Execution Dispatch ────────────────────────────────────────────────

export async function executeReactTool(
    name: string,
    args: Record<string, any>,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        switch (name) {
            case 'read_user_schedule': {
                const result = await readUserScheduleTool(context.userId);
                return {
                    success: result.success,
                    data: result.rawResult,
                    summary: result.resultSummary,
                };
            }

            case 'search_campus_faq': {
                const query = args.query || '';
                const result = await searchCampusFaqTool(query);
                return {
                    success: result.success,
                    data: result.rawResult,
                    summary: result.resultSummary,
                };
            }

            case 'read_campus_building': {
                const query = args.query || '';
                const result = await readCampusBuildingTool(query);
                return {
                    success: result.success,
                    data: result.rawResult,
                    summary: result.resultSummary,
                };
            }

            case 'find_nearby_place': {
                const query = args.query || '';
                const result = await findNearbyPlaceTool(query, context.deviceLocation);
                return {
                    success: result.success,
                    data: result.rawResult,
                    summary: result.resultSummary,
                };
            }

            case 'read_memory_facts': {
                const facts = await readMemoryFactsTool(context.userId);
                return {
                    success: true,
                    data: facts,
                    summary: `loaded ${Object.keys(facts).length} memory facts`,
                };
            }

            default:
                return {
                    success: false,
                    error: `Unknown tool: ${name}`,
                    summary: `Tool "${name}" not found`,
                };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ReactTool] ${name} failed:`, error);
        return {
            success: false,
            error: errorMessage,
            summary: `Tool "${name}" execution failed: ${errorMessage}`,
        };
    }
}

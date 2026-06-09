import { formatBuildingInfo, formatNearbyPlaceInfo } from '../../campus_queries';

export const readCampusBuildingTool = async (query: string) => {
    const result = await formatBuildingInfo(query);
    return {
        toolName: 'read_campus_building',
        success: true,
        resultSummary: 'building info loaded',
        rawResult: result,
        retryable: false,
    };
};

export const findNearbyPlaceTool = async (query: string, deviceLocation?: { latitude: number; longitude: number } | null) => {
    const result = await formatNearbyPlaceInfo(query, deviceLocation);
    return {
        toolName: 'find_nearby_place',
        success: true,
        resultSummary: 'nearby place lookup finished',
        rawResult: result,
        retryable: false,
    };
};

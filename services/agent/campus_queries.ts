import { CAMPUS_BUILDINGS } from '../../data/buildings';
import { CampusLocation } from '../../types';
import { getBuildings } from '../buildings';
import { CAMPUS_LOCATIONS } from '../locations';
import { AgentGeoPoint } from './types';

const BUILDING_CODE_REGEX = /\b(?:AAB|ACC|ACH|AML|ASH|CEC|CVA|DLB|FC|FSC|JSC|LMC|NTT|OEE|OEM|OEW|RRS|SCC|SCM|SCT|SPH|SRH|STB|SWT|WHS|WLB|YSS)\b/i;

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');

const getDistanceMeters = (a: AgentGeoPoint, b: AgentGeoPoint): number => {
    const toRad = (value: number) => value * (Math.PI / 180);
    const earthRadiusMeters = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const haversine = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} 米`;
    return `${(meters / 1000).toFixed(1)} 公里`;
};

const getBuildingLabel = (building: CampusLocation): string => {
    const description = building.description?.trim();
    if (!description) return building.name;
    if (description.toLowerCase() === building.name.toLowerCase()) return building.name;
    return `${building.name} (${description})`;
};

const getFoodLocations = (): CampusLocation[] => CAMPUS_LOCATIONS.filter(location => location.category === 'Food');

const getBuildingSearchText = (building: CampusLocation): string => normalize([
    building.id,
    building.name,
    building.description,
].filter(Boolean).join(' '));

export const isNearbyPlaceQuery = (query: string): boolean => {
    return /附近|最近|离我最近|離我最近|near me|nearest|around me|我在哪|我在哪儿|我在哪裡|where am i|current location|当前位置|當前位置/i.test(query);
};

export const isBuildingInfoQuery = (query: string): boolean => {
    if (isNearbyPlaceQuery(query)) return false;
    return /建筑|建築|大楼|大樓|教学楼|教學樓|在哪|在哪里|在哪裡|where is|location of|building/i.test(query)
        || BUILDING_CODE_REGEX.test(query);
};

const getExplicitBuildingCode = (query: string): string | null => {
    const match = query.toUpperCase().match(BUILDING_CODE_REGEX);
    return match ? match[0] : null;
};

const scoreBuildingMatch = (building: CampusLocation, query: string): number => {
    const normalizedQuery = normalize(query);
    const code = building.name.toUpperCase();
    const description = normalize(building.description || '');
    const searchText = getBuildingSearchText(building);

    if (!normalizedQuery) return 0;
    if (normalizedQuery === normalize(code)) return 100;
    if (normalizedQuery.includes(normalize(code))) return 90;
    if (description && normalizedQuery.includes(description)) return 80;
    if (searchText.includes(normalizedQuery)) return 70;
    if (normalizedQuery.split(/(?=[a-z])|\s+/).some(part => part && searchText.includes(normalize(part)))) return 20;
    return 0;
};

export const loadCampusBuildings = async (): Promise<CampusLocation[]> => {
    try {
        const buildings = await getBuildings();
        if (buildings.length > 0) return buildings;
    } catch (error) {
        console.warn('[Agent] Falling back to static campus buildings:', error);
    }

    return CAMPUS_BUILDINGS;
};

export const findBuildingFromQuery = async (query: string): Promise<CampusLocation | null> => {
    const buildings = await loadCampusBuildings();
    const explicitCode = getExplicitBuildingCode(query);

    if (explicitCode) {
        const byCode = buildings.find(building => building.name.toUpperCase() === explicitCode);
        if (byCode) return byCode;
    }

    let bestMatch: CampusLocation | null = null;
    let bestScore = 0;

    for (const building of buildings) {
        const score = scoreBuildingMatch(building, query);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = building;
        }
    }

    return bestScore >= 70 ? bestMatch : null;
};

export const formatBuildingInfo = async (query: string): Promise<string> => {
    const building = await findBuildingFromQuery(query);
    if (!building) {
        return '我暂时没定位到你说的是哪栋楼。你可以直接发楼名或简称，比如 AAB、WLB、DLB。';
    }

    const nearbyFood = getFoodLocations()
        .map(location => ({
            location,
            distanceMeters: getDistanceMeters(building.coordinates, location.coordinates),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, 2);

    const nearbyText = nearbyFood.length > 0
        ? `附近吃饭可以看 ${nearbyFood.map(item => `${item.location.name}（约 ${formatDistance(item.distanceMeters)}）`).join('、')}。`
        : '';

    const parts = [
        `${getBuildingLabel(building)} 在 HKBU 校园内。`,
        `坐标是 ${building.coordinates.latitude.toFixed(6)}, ${building.coordinates.longitude.toFixed(6)}。`,
        building.category ? `类别：${building.category}。` : '',
        nearbyText,
    ].filter(Boolean);

    return parts.join(' ');
};

const getNearestLocation = (origin: AgentGeoPoint, locations: CampusLocation[]): { location: CampusLocation; distanceMeters: number } | null => {
    if (locations.length === 0) return null;

    const ranked = locations
        .map(location => ({
            location,
            distanceMeters: getDistanceMeters(origin, location.coordinates),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return ranked[0] || null;
};

export const formatNearbyPlaceInfo = async (query: string, deviceLocation?: AgentGeoPoint | null): Promise<string> => {
    if (!deviceLocation) {
        return '我现在还拿不到你的实时定位。请允许定位权限后再问我“离我最近的建筑/餐厅是什么”。';
    }

    const buildings = await loadCampusBuildings();
    const nearestBuilding = getNearestLocation(deviceLocation, buildings);
    const nearestFood = getNearestLocation(deviceLocation, getFoodLocations());
    const wantsFoodOnly = /餐厅|食堂|吃饭|咖啡|canteen|restaurant|cafe|food/i.test(query);
    const wantsBuildingOnly = /建筑|建築|大楼|大樓|楼|樓|building/i.test(query) && !wantsFoodOnly;
    const wantsCurrentLocation = /我在哪|我在哪儿|我在哪裡|where am i|当前位置|當前位置|current location/i.test(query);

    if (wantsFoodOnly && nearestFood) {
        return `离你最近的餐厅是 ${nearestFood.location.name}，约 ${formatDistance(nearestFood.distanceMeters)}，位置在 ${nearestFood.location.description}。`;
    }

    if (wantsBuildingOnly && nearestBuilding) {
        return `离你最近的建筑是 ${getBuildingLabel(nearestBuilding.location)}，约 ${formatDistance(nearestBuilding.distanceMeters)}。`;
    }

    const lines = [];

    if (wantsCurrentLocation && nearestBuilding) {
        lines.push(`你现在最接近 ${getBuildingLabel(nearestBuilding.location)}，约 ${formatDistance(nearestBuilding.distanceMeters)}。`);
    }

    if (nearestBuilding) {
        lines.push(`最近的建筑：${getBuildingLabel(nearestBuilding.location)}，约 ${formatDistance(nearestBuilding.distanceMeters)}。`);
    }

    if (nearestFood) {
        lines.push(`最近的餐厅：${nearestFood.location.name}，约 ${formatDistance(nearestFood.distanceMeters)}，在 ${nearestFood.location.description}。`);
    }

    if (lines.length === 0) {
        return '我暂时没法根据当前位置找到附近的建筑或餐厅。';
    }

    return lines.join('\n');
};

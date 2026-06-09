import { CampusLocation } from '../types';
import { supabase } from './supabase';

// Node-compatible buildings service. Reads the real `buildings` table and
// falls back to the static dataset on failure (handled by the caller).
let cachedBuildings: CampusLocation[] | null = null;

const HIDDEN_BUILDING_IDS = new Set<string>();

export const getBuildings = async (forceRefresh = false): Promise<CampusLocation[]> => {
    if (forceRefresh) {
        cachedBuildings = null;
    }
    if (cachedBuildings) return cachedBuildings;

    const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error fetching buildings:', error.message);
        throw error;
    }

    cachedBuildings = (data || [])
        .filter((b: any) => !HIDDEN_BUILDING_IDS.has(b.id))
        .map((b: any) => ({
            id: b.id,
            name: b.name,
            category: b.category,
            description: b.description,
            imageUrl: b.image_url,
            coordinates: {
                latitude: b.lat,
                longitude: b.lng,
            },
        }));

    return cachedBuildings;
};

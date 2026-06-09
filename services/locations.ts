import { CampusLocation } from '../types';

// Mock data for HKBU campus locations
export const CAMPUS_LOCATIONS: CampusLocation[] = [
    // Food Spots (Building Centroids for maximum precision)
    {
        id: 'o1',
        name: 'Main Canteen',
        category: 'Food',
        coordinates: { latitude: 22.3364312037613, longitude: 114.182351231575 },
        description: 'Level 5, Academic and Administration Building (AAB).',
        rating: 4.2,
        hours: '07:30 - 20:00',
        imageUrl: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o2',
        name: 'Pacific Coffee @ iCafe',
        category: 'Food',
        coordinates: { latitude: 22.3377659528824, longitude: 114.181895256042 },
        description: 'Level 3, The Wing Lung Bank Building (WLB).',
        rating: 4.8,
        hours: '08:00 - 20:00',
        imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o5',
        name: 'Harmony Cafeteria',
        category: 'Food',
        coordinates: { latitude: 22.3401774003134, longitude: 114.179707564888 },
        description: 'Level 4, Sir Run Run Shaw Building (RRS).',
        rating: 4.0,
        hours: '07:30 - 19:30',
        imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o6',
        name: 'the street cafe @ Harmony Lounge',
        category: 'Food',
        coordinates: { latitude: 22.3403874003134, longitude: 114.179647564888 },
        description: 'Level 4, Sir Run Run Shaw Building (RRS).',
        rating: 4.2,
        hours: '08:00 - 18:00',
        imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o7',
        name: 'Compass @ Nan Yuan',
        category: 'Food',
        coordinates: { latitude: 22.3370812132935, longitude: 114.181879162788 },
        description: 'Level 2, David C. Lam Building (DLB).',
        rating: 4.0,
        hours: '11:00 - 22:00',
        imageUrl: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o8',
        name: 'H.F.C. @ Scholars Court',
        category: 'Food',
        coordinates: { latitude: 22.3371812132935, longitude: 114.181879162788 },
        description: 'Level 2, David C. Lam Building (DLB).',
        rating: 4.1,
        hours: '08:00 - 18:00',
        imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o9',
        name: 'Attic @ Bistro NTT',
        category: 'Food',
        coordinates: { latitude: 22.3362972319543, longitude: 114.181643128395 },
        description: 'G/F, Dr. Ng Tor Tai International House (NTT).',
        rating: 4.5,
        hours: '08:00 - 22:00',
        imageUrl: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o10',
        name: "Morimori @ Books 'n Bites",
        category: 'Food',
        coordinates: { latitude: 22.3360243260236, longitude: 114.182597994804 },
        description: 'G/F, Jockey Club Academic Community Centre (ACC).',
        rating: 4.4,
        hours: '09:00 - 19:00',
        imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o11',
        name: 'Café@CVA Commons',
        category: 'Food',
        coordinates: { latitude: 22.3342132094962, longitude: 114.182361960411 },
        description: 'G/F, CVA Building. Fresh tea and bakery.',
        rating: 4.0,
        hours: 'Currently Closed',
        imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o3',
        name: 'Chapter Coffee @ JCCC UG/F Cafe',
        category: 'Food',
        coordinates: { latitude: 22.33557, longitude: 114.18175 },
        description: 'UG/F, Jockey Club Campus of Creativity (JCCC).',
        rating: 4.6,
        hours: '08:00 - 20:00',
        imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o14',
        name: 'Grove & OORI Hansik @ JCCC G/F Cafe',
        category: 'Food',
        coordinates: { latitude: 22.336
            , longitude: 114.18175 },
        description: 'G/F, Jockey Club Campus of Creativity (JCCC).',
        rating: 4.5,
        hours: '08:00 - 21:00',
        imageUrl: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=500&q=60',
    },
    {
        id: 'o13',
        name: 'BU Fiesta',
        category: 'Food',
        coordinates: { latitude: 22.3351609473798, longitude: 114.18250143528 },
        description: 'G/F, Undergraduate Halls (SRH).',
        rating: 4.3,
        hours: '08:00 - 22:00',
        imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=500&q=60',
    },

    // Study Spots
    {
        id: 'study-1',
        name: 'University Library',
        category: 'Study',
        coordinates: { latitude: 22.3372, longitude: 114.1805 },
        description: '主图书馆，藏书丰富，多个自习区域',
        rating: 4.8,
        hours: '08:00 - 22:00',
    },
    {
        id: 'study-2',
        name: 'Learning Commons',
        category: 'Study',
        coordinates: { latitude: 22.3375, longitude: 114.1810 },
        description: '24小时开放的学习空间，有小组讨论室',
        rating: 4.6,
        hours: '24/7',
    },
    {
        id: 'study-3',
        name: 'CVA Study Lounge',
        category: 'Study',
        coordinates: { latitude: 22.3368, longitude: 114.1818 },
        description: '视觉艺术学院自习室，氛围文艺',
        rating: 4.4,
        hours: '09:00 - 21:00',
    },

    // Campus Cats
    {
        id: 'cat-1',
        name: '橘猫 "肥橘"',
        category: 'Campus Cats',
        coordinates: { latitude: 22.3380, longitude: 114.1812 },
        description: '经常出没于图书馆门口，喜欢晒太阳，不怕人',
        rating: 5.0,
    },
    {
        id: 'cat-2',
        name: '黑白猫 "奶牛"',
        category: 'Campus Cats',
        coordinates: { latitude: 22.3388, longitude: 114.1825 },
        description: '住在体育馆附近，性格高冷，偶尔接受投喂',
        rating: 4.9,
    },
    {
        id: 'cat-3',
        name: '花猫 "花花"',
        category: 'Campus Cats',
        coordinates: { latitude: 22.3365, longitude: 114.1800 },
        description: '常在文学院楼下游荡，非常亲人',
        rating: 4.8,
    },
];

// Get all locations
export const getLocations = (): CampusLocation[] => {
    return CAMPUS_LOCATIONS;
};

// Get locations by category
export const getLocationsByCategory = (category: CampusLocation['category']): CampusLocation[] => {
    return CAMPUS_LOCATIONS.filter(loc => loc.category === category);
};

// Get location by ID
export const getLocationById = (id: string): CampusLocation | undefined => {
    return CAMPUS_LOCATIONS.find(loc => loc.id === id);
};

// Category icons mapping
export const CATEGORY_ICONS: Record<CampusLocation['category'], string> = {
    'Food': '🍽️',
    'Study': '📚',
    'Campus Cats': '🐱',
    'Sports': '⚽',
    'Other': '📍',
};

// Category colors mapping
export const CATEGORY_COLORS: Record<CampusLocation['category'], string> = {
    'Food': '#FF6B6B',
    'Study': '#4ECDC4',
    'Campus Cats': '#FFE66D',
    'Sports': '#95E1D3',
    'Other': '#A8A8A8',
};

// Minimal shared types extracted from HKCampus for the standalone CampusAgent.

export type LocationCategory = 'Food' | 'Study' | 'Campus Cats' | 'Sports' | 'Other';

export interface CampusLocation {
    id: string;
    name: string;
    category: LocationCategory;
    coordinates: {
        latitude: number;
        longitude: number;
    };
    description: string;
    rating?: number;
    imageUrl?: string;
    hours?: string;
}

export interface Course {
    id: string;
    code: string;
    name: string;
    instructor: string;
    department: string;
    credits: number;
    rating: number;
    reviewCount: number;
}

export interface Review {
    id: string;
    courseId: string;
    authorId: string;
    authorName: string;
    authorEmail?: string;
    authorAvatar: string;
    rating?: number;
    difficulty: number;
    content: string;
    tags: string[];
    likes: number;
    createdAt: Date;
    semester: string;
    isAnonymous?: boolean;
}

export interface ContactMethod {
    platform: 'WeChat' | 'WhatsApp' | 'Email' | 'Instagram' | 'Telegram' | 'Other';
    otherPlatformName?: string;
    value: string;
}

export interface CourseTeaming {
    id: string;
    courseId: string;
    userId: string;
    userName: string;
    userEmail?: string;
    userAvatar: string;
    userMajor?: string;
    section: string;
    selfIntro?: string;
    targetTeammate?: string;
    contacts: ContactMethod[];
    createdAt: Date;
    status: 'open' | 'closed';
    likes: number;
    isLiked?: boolean;
    commentCount: number;
}

export interface TeamingComment {
    id: string;
    teamingId: string;
    authorId: string;
    authorName: string;
    authorEmail?: string;
    authorAvatar: string;
    content: string;
    parentCommentId?: string;
    replyToName?: string;
    createdAt: Date;
}

export interface Teacher {
    id: string;
    faculty: string;
    department: string;
    name: string;
    title: string;
    imageUrl: string;
    email: string;
    sourceUrl: string;
    ratingAvg: number;
    reviewCount: number;
    tags: string[];
}

export interface TeacherReview {
    id: string;
    teacherId: string;
    authorId: string;
    authorName: string;
    authorEmail?: string;
    authorAvatar?: string;
    rating: number;
    difficulty: number;
    workload: number;
    content: string;
    tags: string[];
    likes: number;
    isLiked?: boolean;
    createdAt: Date;
}

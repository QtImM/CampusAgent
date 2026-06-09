export type AgentIntent =
    | 'campus_faq'
    | 'schedule_query'
    | 'course_community_read'
    | 'course_community_write'
    | 'building_query'
    | 'nearby_place_query'
    | 'date_query'
    | 'unknown';

export type RouteDecision = {
    intent: AgentIntent;
    confidence: number;
    useLocalRoute: boolean;
    useTool?: 'search_campus_faq' | 'read_user_schedule' | 'read_course_community' | 'read_campus_building' | 'find_nearby_place';
    reason: string;
};

export type ModelRouteDecision = {
    tier: 'fast' | 'reasoning';
    reason: string;
    complexity: 'simple' | 'moderate' | 'complex';
    directResponsePreferred: boolean;
};

const score = (query: string, pattern: RegExp, weight: number): number => pattern.test(query) ? weight : 0;

export const classifyIntent = (query: string): RouteDecision => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return { intent: 'unknown', confidence: 0, useLocalRoute: false, reason: 'empty query' };
    }

    const scores: Record<Exclude<AgentIntent, 'unknown'>, number> = {
        campus_faq: 0,
        schedule_query: 0,
        course_community_read: 0,
        course_community_write: 0,
        building_query: 0,
        nearby_place_query: 0,
        date_query: 0,
    };

    scores.schedule_query += score(normalized, /课表|課表|今天.*课|今天.*堂|今日.*堂|今日.*课|明天.*课|明天.*堂|有咩堂|下一节|next class|today.*class|tomorrow.*class|class.*today|class.*tomorrow|what.*class|周[一二三四五六日天].*课|星期[一二三四五六日天].*课/, 7);
    scores.course_community_read += score(normalized, /课程|課程|这门课|這門課|评价|評價|点评|點評|聊天室|群聊|chatroom|teaming|队友|隊友|口碑|活跃|活躍/, 7);
    scores.course_community_write += score(normalized, /帮我发|幫我發|发布|發布|想.*评价|想.*評價|要.*评价|要.*評價|写.*评价|寫.*評價|发.*聊天室|發.*聊天室|发.*消息|發.*消息|我想组队|我希望组队|找队友|找隊友|组队.*找|組隊.*找/, 9);
    scores.building_query += score(normalized, /建筑|建築|大楼|大樓|教学楼|教學樓|where is|building|aab|wlb|dlb|scm|swt/, 6);
    scores.nearby_place_query += score(normalized, /附近|最近|离我最近|離我最近|near me|nearest|around me|我在哪|where am i|当前位置|當前位置/, 8);
    scores.date_query += score(normalized, /今天.*周几|今天星期几|今天週幾|明天.*周几|明天星期几|today.*what day|tomorrow.*what day/, 8);
    scores.campus_faq += score(normalized, /图书馆|圖書館|library|main lib|gpa|绩点|績點|平均分|academic calendar|calendar|校历|校曆|学费|學費|fee|tuition|宿舍|住宿|hall|residence|wifi|eduroam|it support|it service|ito|email|邮箱|郵箱|transcript|成绩单|成績單|handbook|学生手册|學生手冊|admission|入学|入學|accept offer|录取|錄取|visa|签证|簽證|iang|financial aid|奖学金|獎學金/, 5);

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [intent, topScore] = ranked[0] as [AgentIntent, number];
    const secondScore = ranked[1]?.[1] || 0;

    if (!topScore || topScore < 5 || topScore - secondScore < 2) {
        return {
            intent: 'unknown',
            confidence: topScore ? 0.45 : 0,
            useLocalRoute: false,
            reason: 'low confidence intent classification',
        };
    }

    const toolMap: Partial<Record<AgentIntent, RouteDecision['useTool']>> = {
        campus_faq: 'search_campus_faq',
        schedule_query: 'read_user_schedule',
        course_community_read: 'read_course_community',
        building_query: 'read_campus_building',
        nearby_place_query: 'find_nearby_place',
    };

    return {
        intent,
        confidence: Math.min(0.98, topScore / 10),
        useLocalRoute: intent !== 'course_community_write' && intent !== 'unknown',
        useTool: toolMap[intent],
        reason: `intent=${intent}, score=${topScore}`,
    };
};

const hasComplexSignal = (query: string): boolean => (
    /分析|比較|比较|對比|对比|规划|規劃|plan|strategy|建议|建議|推荐|推薦|为什么|為什麼|原因|步驟|步骤|一步一步|detailed|explain|pros and cons|优缺点|優缺點|總結|总结|同時|同时|multiple|multi-step/i.test(query)
);

const hasModerateSignal = (query: string): boolean => (
    /怎麼|怎么|如何|should|which|哪個|哪个|選|选|difference|區別|区别/i.test(query)
);

export const selectModelRoute = (
    query: string,
    options?: {
        intentDecision?: RouteDecision;
        historyLength?: number;
        hasPendingWrite?: boolean;
        hasPendingCourseAction?: boolean;
        previousSteps?: Array<{ action?: { tool: string; input: any }; observation?: string }>;
    }
): ModelRouteDecision => {
    const normalized = query.trim();
    const historyLength = options?.historyLength || 0;
    const intentDecision = options?.intentDecision;
    const previousSteps = options?.previousSteps || [];
    const hasToolObservations = previousSteps.some(step => step.action && step.observation);
    const hasAmbiguousObservation = previousSteps.some(step => (
        /暂时|失敗|失败|error|not found|找不到|没定位|沒有定位|不完整|需要|缺少|无法|無法|冲突|衝突|请补充|請補充/i
    ).test(step.observation || ''));

    if (options?.hasPendingWrite || options?.hasPendingCourseAction || intentDecision?.intent === 'course_community_write') {
        return {
            tier: 'reasoning',
            reason: 'write flow or pending state requires higher reliability',
            complexity: 'complex',
            directResponsePreferred: false,
        };
    }

    if (hasAmbiguousObservation || previousSteps.length >= 2) {
        return {
            tier: 'reasoning',
            reason: 'tool observations increased uncertainty',
            complexity: 'complex',
            directResponsePreferred: false,
        };
    }

    if (hasToolObservations) {
        return {
            tier: 'reasoning',
            reason: 'tool-assisted follow-up benefits from deeper synthesis',
            complexity: 'moderate',
            directResponsePreferred: false,
        };
    }

    if (hasComplexSignal(normalized) || historyLength > 8) {
        return {
            tier: 'reasoning',
            reason: 'complex prompt or long conversation context',
            complexity: 'complex',
            directResponsePreferred: false,
        };
    }

    if (hasModerateSignal(normalized)) {
        return {
            tier: 'fast',
            reason: 'moderate question, fast model preferred first',
            complexity: 'moderate',
            directResponsePreferred: true,
        };
    }

    return {
        tier: 'fast',
        reason: 'simple direct question',
        complexity: 'simple',
        directResponsePreferred: true,
    };
};

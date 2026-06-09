type KnowledgeBaseRow = {
    content: string;
    metadata?: Record<string, any>;
    similarity?: number;
};

export type RankedKnowledgeBaseRow = KnowledgeBaseRow & {
    score: number;
};

const normalize = (value: string): string => value
    .toLowerCase()
    .replace(/[？?！!，,。.:：;；"'`()\[\]{}<>/\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const expandRetrievalTerms = (query: string): string[] => {
    const normalized = normalize(query);
    const terms = new Set(normalized.split(' ').filter(Boolean));

    const synonymGroups: Array<{ patterns: RegExp[]; terms: string[] }> = [
        { patterns: [/gpa|绩点|績點|平均分/], terms: ['gpa', '绩点', '平均分'] },
        { patterns: [/library|图书馆|圖書館|main lib/], terms: ['library', '图书馆'] },
        { patterns: [/calendar|校历|校曆|academic calendar/], terms: ['calendar', '校历', 'academic calendar'] },
        { patterns: [/hall|宿舍|住宿|residence|租房|租屋/], terms: ['hall', '宿舍', '住宿', '租房'] },
        { patterns: [/wifi|eduroam|internet|网络|網絡/], terms: ['wifi', 'eduroam', 'internet', '网络'] },
        { patterns: [/it service|it support|ito|技术支持|技術支援/], terms: ['it support', 'it service', 'ito'] },
        { patterns: [/tuition|fee|学费|學費|费用|費用/], terms: ['tuition', 'fee', '学费', '费用'] },
        { patterns: [/visa|签证|簽證|iang|d签|逗留签/], terms: ['visa', '签证', 'iang', 'e-visa', '逗留签'] },
        { patterns: [/transcript|成绩单|成績單/], terms: ['transcript', '成绩单'] },
        { patterns: [/留位费|留位費|deposit|押金|缴费|繳費/], terms: ['留位费', 'deposit', '缴费', 'flywire', '电汇'] },
        { patterns: [/食堂|canteen|餐厅|餐廳|吃饭|饭堂/], terms: ['食堂', 'canteen', '餐厅'] },
        { patterns: [/医疗|醫療|看病|医生|校医|诊所|clinic|health/], terms: ['医疗', '校医', '诊所', 'clinic'] },
        { patterns: [/体育|健身|gym|游泳|运动|sport/], terms: ['体育', '健身', 'gym', '游泳', '运动'] },
        { patterns: [/打印|print|复印/], terms: ['打印', 'print', '复印', 'AMDP'] },
        { patterns: [/交通|transport|地铁|巴士|bus|小巴/], terms: ['交通', '地铁', '巴士', '小巴', '九龙塘'] },
        { patterns: [/抵港|来港|到港|入境|报到/], terms: ['抵港', '入境', '报到', '电话卡', '八达通'] },
        { patterns: [/新生|freshman|orientation|迎新/], terms: ['新生', '入学', 'orientation', '迎新'] },
        { patterns: [/选课|選課|add drop|课程/], terms: ['选课', 'add drop', 'BUniPort', '课程'] },
        { patterns: [/八达通|octopus/], terms: ['八达通', 'octopus'] },
        { patterns: [/银行|开户|bank/], terms: ['银行', '开户', 'bank'] },
    ];

    synonymGroups.forEach(group => {
        if (group.patterns.some(pattern => pattern.test(normalized))) {
            group.terms.forEach(term => terms.add(term));
        }
    });

    return Array.from(terms);
};

const scoreRow = (query: string, row: KnowledgeBaseRow): number => {
    const normalizedQuery = normalize(query);
    const queryTerms = expandRetrievalTerms(query);
    const content = normalize(row.content || '');
    const metadataText = normalize(Object.values(row.metadata || {}).join(' '));

    let score = typeof row.similarity === 'number' ? row.similarity * 10 : 0;

    if (content.includes(normalizedQuery)) score += 10;
    if (metadataText && metadataText.includes(normalizedQuery)) score += 6;

    queryTerms.forEach(term => {
        if (content.includes(term)) score += 3;
        if (metadataText.includes(term)) score += 2;
    });

    return score;
};

export const rerankKnowledgeBaseResults = (
    query: string,
    rows: KnowledgeBaseRow[]
): RankedKnowledgeBaseRow[] => {
    return rows
        .map(row => ({
            ...row,
            score: scoreRow(query, row),
        }))
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
};

export const inferRetrievalTopic = (
    query: string,
    faqQuestion?: string,
    kbMetadata?: Record<string, any>
): string => {
    const fallback = faqQuestion || query;
    const header = [kbMetadata?.h2, kbMetadata?.h3].filter(Boolean).join(' / ');
    return header || fallback;
};

export const buildEvidenceSnippet = (content: string, max = 140): string => {
    const flattened = String(content || '').replace(/\s+/g, ' ').trim();
    return flattened.length > max ? `${flattened.slice(0, max)}...` : flattened;
};


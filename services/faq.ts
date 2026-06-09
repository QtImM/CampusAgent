import campusFaq from '../data/campus_faq.json';
import { supabase } from './supabase';
import {
    buildEvidenceSnippet,
    expandRetrievalTerms,
    inferRetrievalTopic,
    rerankKnowledgeBaseResults,
} from './agent/retrieval';

export interface FAQEntry {
    id: string;
    question: string;
    question_zh: string;
    answer: string;
    answer_zh: string;
    keywords: string[];
    related_links?: string[];
}

export interface FAQCategory {
    id: string;
    name: string;
    name_zh: string;
    description?: string;
    description_zh?: string;
    faqs?: FAQEntry[];
    subcategories?: {
        id: string;
        name: string;
        name_zh: string;
        faqs: FAQEntry[];
    }[];
}

export interface FAQData {
    metadata: {
        title: string;
        last_updated: string;
        total_categories: number;
        total_faqs: number;
    };
    categories: FAQCategory[];
}

const data = campusFaq as unknown as FAQData;

type ScoredFAQEntry = {
    faq: FAQEntry;
    score: number;
};

export const normalizeFaqText = (value: string): string => value
    .toLowerCase()
    .replace(/[？?！!，,。.:：;；"'`()\[\]{}<>/\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const expandFaqTerms = (query: string): string[] => {
    const normalized = normalizeFaqText(query);
    const baseTerms = normalized.split(' ').filter(Boolean);
    const expanded = new Set<string>(baseTerms);

    const synonymGroups: Array<{ patterns: RegExp[]; terms: string[] }> = [
        { patterns: [/gpa|绩点|績點|平均分/], terms: ['gpa', '绩点', '平均分'] },
        { patterns: [/library|图书馆|圖書館|main lib/], terms: ['library', '图书馆'] },
        { patterns: [/calendar|校历|校曆|academic calendar/], terms: ['calendar', '校历', 'academic calendar'] },
        { patterns: [/hall|宿舍|住宿|residence/], terms: ['hall', '宿舍', '住宿'] },
        { patterns: [/wifi|eduroam|internet|网络|網絡/], terms: ['wifi', 'eduroam', 'internet', '网络'] },
        { patterns: [/it service|it support|ito|技术支持|技術支援/], terms: ['it service', 'it support', 'ito'] },
        { patterns: [/tuition|fee|学费|學費|费用|費用/], terms: ['tuition', 'fee', '学费', '费用'] },
        { patterns: [/handbook|student handbook|学生手册|學生手冊/], terms: ['handbook', 'student handbook', '学生手册'] },
        { patterns: [/visa|签证|簽證|iang/], terms: ['visa', '签证', 'iang'] },
        { patterns: [/add drop|add\/drop|选课|選課|注册|註冊|reg course/], terms: ['add drop', '选课', '注册', 'reg course'] },
        { patterns: [/transcript|成绩单|成績單/], terms: ['transcript', '成绩单'] },
        { patterns: [/scholarship|financial aid|奖学金|獎學金|资助|資助/], terms: ['scholarship', 'financial aid', '奖学金', '资助'] },
    ];

    synonymGroups.forEach(group => {
        if (group.patterns.some(pattern => pattern.test(normalized))) {
            group.terms.forEach(term => expanded.add(term));
        }
    });

    return Array.from(expanded);
};

const scoreFaqMatch = (query: string, faq: FAQEntry, lang: 'en' | 'zh' = 'zh'): number => {
    const normalizedQuery = normalizeFaqText(query);
    const searchTerms = expandFaqTerms(query);
    const qText = normalizeFaqText(lang === 'zh' ? faq.question_zh : faq.question);
    const aText = normalizeFaqText(lang === 'zh' ? faq.answer_zh : faq.answer);
    const keywords = faq.keywords.map(normalizeFaqText);

    let score = 0;

    if (keywords.some(keyword => keyword.includes(normalizedQuery) || normalizedQuery.includes(keyword))) {
        score += 12;
    }

    if (qText.includes(normalizedQuery)) {
        score += 10;
    }

    if (aText.includes(normalizedQuery)) {
        score += 6;
    }

    searchTerms.forEach(term => {
        if (!term) return;
        if (keywords.some(keyword => keyword.includes(term))) score += 4;
        if (qText.includes(term)) score += 3;
        if (aText.includes(term)) score += 1;
    });

    return score;
};

/**
 * FAQ Service
 * Handles searching and retrieving campus knowledge base information.
 */
export const FAQService = {
    /**
     * Get all categories with basic info
     */
    getCategories() {
        return data.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            name_zh: cat.name_zh,
            description: cat.description,
            description_zh: cat.description_zh,
        }));
    },

    /**
     * Get all FAQs for a specific category or subcategory
     */
    getFAQsByCategory(categoryId: string, subcategoryId?: string): FAQEntry[] {
        const category = data.categories.find(c => c.id === categoryId);
        if (!category) return [];

        if (subcategoryId && category.subcategories) {
            const sub = category.subcategories.find(s => s.id === subcategoryId);
            return sub ? sub.faqs : [];
        }

        return category.faqs || [];
    },

    /**
     * Search across all FAQs using keywords and text matching
     * @param query Search string
     * @param lang 'en' or 'zh'
     */
    searchFAQs(query: string, lang: 'en' | 'zh' = 'zh'): FAQEntry[] {
        const normalizedQuery = normalizeFaqText(query);
        if (!normalizedQuery) return [];

        const scoredResults: ScoredFAQEntry[] = [];

        data.categories.forEach(category => {
            // Helper to process a list of FAQs
            const processFAQs = (faqs: FAQEntry[]) => {
                faqs.forEach(faq => {
                    const score = scoreFaqMatch(query, faq, lang);
                    if (score > 0) {
                        scoredResults.push({ faq, score });
                    }
                });
            };

            if (category.faqs) processFAQs(category.faqs);
            if (category.subcategories) {
                category.subcategories.forEach(sub => processFAQs(sub.faqs));
            }
        });

        const deduped = new Map<string, { faq: FAQEntry; score: number }>();
        scoredResults.forEach(item => {
            const existing = deduped.get(item.faq.id);
            if (!existing || item.score > existing.score) {
                deduped.set(item.faq.id, item);
            }
        });

        return Array.from(deduped.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(item => item.faq);
    },

    /**
     * Get a specific FAQ by ID
     */
    getFAQById(id: string): FAQEntry | undefined {
        let found: FAQEntry | undefined;

        data.categories.some(category => {
            if (category.faqs) {
                found = category.faqs.find(f => f.id === id);
                if (found) return true;
            }
            if (category.subcategories) {
                category.subcategories.some(sub => {
                    found = sub.faqs.find(f => f.id === id);
                    if (found) return true;
                    return false;
                });
                if (found) return true;
            }
            return false;
        });

        return found;
    },

    /**
     * Search the Supabase knowledge base (RAG chunks).
     * Primary: Edge Function embed-search (cloud embedding + vector similarity, ~200ms).
     * Fallback: ILIKE keyword search if Edge Function unavailable.
     */
    async searchKnowledgeBase(query: string) {
        // 优先使用 Edge Function（云端 embedding + 向量搜索）
        try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke(
                'embed-search',
                { body: { query, match_count: 5 } },
            );

            if (!fnError && fnData?.data && fnData.data.length > 0) {
                return (fnData.data as Array<{ content: string; metadata: any; similarity: number }>)
                    .map((row) => ({
                        content: row.content,
                        metadata: row.metadata,
                        score: row.similarity,
                    }));
            }

            if (fnError) {
                console.warn('[FAQService] Edge Function fallback to ILIKE:', fnError);
            }
        } catch (e) {
            console.warn('[FAQService] Edge Function unavailable, using ILIKE fallback:', e);
        }

        // Fallback: ILIKE keyword search
        const searchTerms = expandRetrievalTerms(query);
        let dbQuery = supabase
            .from('agent_knowledge_base')
            .select('content, metadata');

        if (searchTerms.length > 0) {
            const orQuery = searchTerms
                .filter((word: string) => word.length > 1)
                .slice(0, 5)
                .map((word: string) => `content.ilike.%${word}%`)
                .join(',');
            dbQuery = dbQuery.or(orQuery);
        } else {
            dbQuery = dbQuery.ilike('content', `%${query}%`);
        }

        const { data: dbData, error } = await dbQuery.limit(8);

        if (error) {
            console.error('[FAQService] Supabase search error:', error);
            return [];
        }

        return rerankKnowledgeBaseResults(query, dbData || []);
    },

    buildCampusFaqAnswer(
        query: string,
        localResults: FAQEntry[],
        kbResults: Array<{ content: string; metadata?: Record<string, any>; score?: number }>
    ): string {
        if (localResults.length === 0 && kbResults.length === 0) {
            return '我暂时没在现有校园资料里找到明确答案。你可以换几个关键词再问一次，或者直接查看 HKBU 官方网站。';
        }

        const scoredLocalResults = localResults
            .map(faq => ({ faq, score: scoreFaqMatch(query, faq) }))
            .sort((a, b) => b.score - a.score);
        const bestFaqCandidate = scoredLocalResults[0];
        const bestKb = kbResults[0];
        const bestFaqScore = bestFaqCandidate?.score || 0;
        const bestKbScore = bestKb?.score || 0;
        const preferKnowledgeBase = Boolean(
            bestKb?.content && (
                !bestFaqCandidate ||
                bestFaqScore < 12 ||
                bestKbScore >= bestFaqScore + 2
            )
        );
        const bestFaq = preferKnowledgeBase ? undefined : bestFaqCandidate?.faq;
        const topic = inferRetrievalTopic(query, bestFaq?.question_zh || bestFaqCandidate?.faq.question_zh, bestKb?.metadata);

        const sections: string[] = [`命中主题：${topic}`];

        if (bestFaq?.answer_zh) {
            sections.push(`结论：${bestFaq.answer_zh}`);
        } else if (bestKb?.content) {
            sections.push(`结论：${buildEvidenceSnippet(bestKb.content, 120)}`);
        }

        if (kbResults.length > 0) {
            const evidence = kbResults
                .slice(0, 2)
                .map((item, index) => `${index + 1}. ${buildEvidenceSnippet(item.content)}`)
                .join('\n');
            sections.push(`证据片段：\n${evidence}`);
        }

        const sourceLinks = (bestFaq?.related_links || []).slice(0, 2);
        if (sourceLinks.length > 0) {
            sections.push(`建议来源：\n${sourceLinks.join('\n')}`);
        } else {
            sections.push('建议来源：如需进一步核对，请查看 HKBU 官方网站对应页面。');
        }

        return sections.join('\n\n');
    },
};

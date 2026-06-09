import { FAQService } from '../../../faq';

export const searchCampusFaqTool = async (query: string) => {
    const local = FAQService.searchFAQs(query);
    const kb = await FAQService.searchKnowledgeBase(query);
    return {
        toolName: 'search_campus_faq',
        success: true,
        resultSummary: `faq=${local.length}, kb=${kb.length}`,
        rawResult: { local, kb },
        retryable: false,
    };
};

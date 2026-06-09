const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const addAliasTerms = (query: string, terms: Set<string>) => {
    if (/add drop|add\/drop|选课|加退课/i.test(query)) {
        ['add drop', 'BUniPort', 'course registration'].forEach(term => terms.add(term));
    }

    if (/gpa|绩点/i.test(query)) {
        ['gpa', 'grade point average'].forEach(term => terms.add(term));
    }
};

export const normalizeGraphQuery = (input: string) => {
    const query = normalize(input);
    const aliasTerms = new Set(query.split(' ').filter(Boolean));
    addAliasTerms(query, aliasTerms);

    return {
        query,
        aliasTerms: Array.from(aliasTerms),
    };
};

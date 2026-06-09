// Minimal i18n shim for the standalone CampusAgent.
// The agent's action runtime only uses a few course-related keys.
const DICT: Record<string, string> = {
    'courses.course_not_found': '没有找到课程代码为 {{code}} 的课程，请确认后重试。',
    'courses.add_course.title': '添加课程',
};

const interpolate = (template: string, params?: Record<string, any>): string => {
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        params[key] != null ? String(params[key]) : `{{${key}}}`
    );
};

const i18n = {
    t(key: string, params?: Record<string, any>): string {
        const template = DICT[key];
        return template ? interpolate(template, params) : key;
    },
};

export default i18n;

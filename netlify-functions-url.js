/**
 * כתובת ל-Netlify Functions כשהאתר לא מוגש מאותו דומיין (GitHub Pages, Firebase Hosting וכו').
 * מוגדר ב-recipe-proxy-config.js: window.__NETLIFY_FUNCTIONS_BASE__
 */

/** תיקיית האתר (למשל /Our-Recipes) כשהאתר לא בראש הדומיין — כדי שלא ילכו בקשות ל־/.netlify בכתובת הלא נכונה */
function sameOriginPathPrefix() {
    if (typeof location === 'undefined') return '';
    const p = location.pathname || '';
    if (!p || p === '/') return '';
    const dir = p.replace(/\/[^/]*$/, '');
    return dir || '';
}

export function getNetlifyFunctionUrl(functionName, queryParams) {
    const base = typeof window !== 'undefined' && window.__NETLIFY_FUNCTIONS_BASE__
        ? String(window.__NETLIFY_FUNCTIONS_BASE__).replace(/\/$/, '')
        : '';
    const qs = queryParams && Object.keys(queryParams).length
        ? '?' + new URLSearchParams(queryParams).toString()
        : '';
    const segment = `/.netlify/functions/${functionName}${qs}`;
    if (base) {
        return `${base}${segment}`;
    }
    return sameOriginPathPrefix() + segment;
}

/** האם כנראה צריך כתובת Netlify חיצונית (אין פונקציות באותו מקור) */
export function netlifyFunctionsNeedExternalBase() {
    if (typeof location === 'undefined') return false;
    if (location.protocol === 'file:') return true;
    const h = location.hostname;
    if (/\.github\.io$/i.test(h)) return true;
    if (/\.web\.app$/i.test(h) || /\.firebaseapp\.com$/i.test(h)) return true;
    return false;
}

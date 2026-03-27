/**
 * אופציונלי: אם תגדירי כאן כתובת Netlify — היא תגבר על מה שב-Firestore.
 * ברירת מחדל: נטען מ-Firestore → config/netlifyFunctions → baseUrl (ראי FIREBASE-SETUP.md).
 */
(function () {
    if (typeof window === 'undefined') return;
    if (window.__NETLIFY_FUNCTIONS_BASE__ !== undefined) return;
    // אם האתר על GitHub Pages: הדביקי למטה (ללא / בסוף), למשל: 'https://your-site.netlify.app'
    window.__NETLIFY_FUNCTIONS_BASE__ = '';
})();

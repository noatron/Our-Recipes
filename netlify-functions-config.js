/**
 * כתובת בסיס ל-Netlify Functions (ייבוא מקישור, חילוץ מתמונה).
 * 1) אם הוגדר ב-recipe-proxy-config.js או ב-window — משתמשים בו.
 * 2) אחרת נטען מ-Firestore: config/netlifyFunctions → שדה baseUrl (מוגדר פעם אחת בקונסול).
 */
import { db } from './firebase.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

let loadPromise = null;

export async function ensureNetlifyFunctionsBase() {
    if (typeof window !== 'undefined' && window.__NETLIFY_FUNCTIONS_BASE__) {
        return window.__NETLIFY_FUNCTIONS_BASE__;
    }
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const snap = await getDoc(doc(db, 'config', 'netlifyFunctions'));
                if (snap.exists()) {
                    const u = snap.data().baseUrl;
                    if (u && typeof u === 'string' && /^https?:\/\//i.test(u.trim())) {
                        const clean = u.trim().replace(/\/$/, '');
                        if (typeof window !== 'undefined') {
                            window.__NETLIFY_FUNCTIONS_BASE__ = clean;
                        }
                        return clean;
                    }
                }
            } catch (_) {
                /* offline / rules */
            }
            return '';
        })();
    }
    await loadPromise;
    return typeof window !== 'undefined' ? (window.__NETLIFY_FUNCTIONS_BASE__ || '') : '';
}
